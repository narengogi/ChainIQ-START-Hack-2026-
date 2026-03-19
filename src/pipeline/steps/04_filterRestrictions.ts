import { query } from "../../db/mysql";
import type { EmitFn, PipelineState } from "../types";

interface RestrictionRow {
  supplier_id:        string;
  supplier_name:      string;
  restriction_scope:  string;
  restriction_reason: string;
}

export async function filterRestrictions(state: PipelineState, emit: EmitFn): Promise<void> {
  if (state.active.length === 0) return;

  const supplierIds = state.active.map((s) => s.supplier_id);
  const placeholders = supplierIds.map(() => "?").join(",");

  const restrictions = await query<RestrictionRow>(
    `SELECT supplier_id, supplier_name, restriction_scope, restriction_reason
     FROM restricted_suppliers
     WHERE supplier_id IN (${placeholders})
       AND category_l2 = ?`,
    [...supplierIds, state.request.category_l2],
  );

  const deliveryCountries = state.request.delivery_countries;
  const budget = state.request.budget_amount;

  const surviving: typeof state.active = [];

  for (const supplier of state.active) {
    const match = restrictions.find((r) => r.supplier_id === supplier.supplier_id);

    if (!match) {
      surviving.push(supplier);
      continue;
    }

    let scope: string[];
    try {
      scope = JSON.parse(match.restriction_scope) as string[];
    } catch {
      scope = ["all"];
    }

    const isGlobal        = scope.includes("all");
    const affectsCountry  = deliveryCountries.some((c) => scope.includes(c));

    // Value-conditional restriction: "Can be used only below EUR 75000 without exception"
    // Detect by looking for a numeric threshold in the reason text
    const thresholdMatch  = match.restriction_reason.match(/[\d\s,]+(?:EUR|CHF|USD)/i);
    const isValueConditional = thresholdMatch !== null;

    if (isGlobal) {
      const reason = `Globally restricted: ${match.restriction_reason}`;
      state.eliminated.push({ supplier, reason, ruleId: "POLICY-RESTRICTED" });
      await emit({ type: "SUPPLIER_ELIMINATED", data: { supplierId: supplier.supplier_id, name: supplier.supplier_name, reason, ruleId: "POLICY-RESTRICTED", step: "Restriction Filter" } });
    } else if (affectsCountry) {
      const reason = `Restricted in delivery country (${scope.filter((c) => deliveryCountries.includes(c)).join(", ")}): ${match.restriction_reason}`;
      state.eliminated.push({ supplier, reason, ruleId: "POLICY-RESTRICTED" });
      await emit({ type: "SUPPLIER_ELIMINATED", data: { supplierId: supplier.supplier_id, name: supplier.supplier_name, reason, ruleId: "POLICY-RESTRICTED", step: "Restriction Filter" } });
    } else if (isValueConditional && budget !== null) {
      // Flag rather than eliminate — human review needed above threshold
      const flag = `Value-conditional restriction applies: ${match.restriction_reason}`;
      state.flagged.push({ supplierId: supplier.supplier_id, flag, severity: "warn" });
      await emit({ type: "SUPPLIER_FLAGGED", data: { supplierId: supplier.supplier_id, name: supplier.supplier_name, flag, severity: "warn" } });
      surviving.push(supplier);
    } else {
      surviving.push(supplier);
    }
  }

  state.active = surviving;
}
