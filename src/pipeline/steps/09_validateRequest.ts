import { query } from "../../db/mysql";
import type { EmitFn, PipelineState, ValidationIssue } from "../types";

interface PricingRow {
  supplier_id:              string;
  min_quantity:             number;
  max_quantity:             number;
  unit_price:               number;
  standard_lead_time_days:  number;
  expedited_lead_time_days: number | null;
}

export async function validateRequest(state: PipelineState, emit: EmitFn): Promise<void> {
  const { request, active, threshold } = state;
  let issueCounter = 1;

  const emitIssue = async (issue: Omit<ValidationIssue, "issue_id">) => {
    const full: ValidationIssue = { issue_id: `V-${String(issueCounter++).padStart(3, "0")}`, ...issue };
    state.validationIssues.push(full);
    await emit({ type: "VALIDATION_ISSUE", data: full });
  };

  // 1. Missing budget
  if (request.budget_amount === null) {
    await emitIssue({
      severity:        "critical",
      type:            "missing_budget",
      description:     "Budget amount is not specified.",
      action_required: "Requester must provide a budget before sourcing can proceed.",
    });
  }

  // 2. Missing quantity
  if (request.quantity === null) {
    await emitIssue({
      severity:        "critical",
      type:            "missing_quantity",
      description:     "Quantity is not specified.",
      action_required: "Requester must confirm the quantity required.",
    });
  }

  // 3. No active suppliers after filtering
  if (active.length === 0) {
    await emitIssue({
      severity:        "critical",
      type:            "no_compliant_supplier",
      description:     "No compliant supplier can be identified after applying all filters.",
      action_required: "Escalate to Head of Category to identify alternative sourcing options.",
    });
    return;
  }

  // 4. Budget vs pricing check (only if we have budget + quantity + active suppliers)
  if (request.budget_amount !== null && request.quantity !== null && active.length > 0) {
    const activeIds   = active.map((s) => s.supplier_id);
    const placeholders = activeIds.map(() => "?").join(",");

    // Determine region from first delivery country
    const regionMap: Record<string, string> = {
      DE: "EU", FR: "EU", NL: "EU", BE: "EU", AT: "EU", IT: "EU",
      ES: "EU", PL: "EU", UK: "EU", CH: "EU",
      US: "Americas", CA: "Americas", BR: "Americas", MX: "Americas",
      SG: "APAC", AU: "APAC", IN: "APAC", JP: "APAC",
      UAE: "MEA", ZA: "MEA",
    };
    const region = regionMap[request.delivery_countries[0]] ?? "EU";

    const pricingRows = await query<PricingRow>(
      `SELECT supplier_id, min_quantity, max_quantity, unit_price,
              standard_lead_time_days, expedited_lead_time_days
       FROM pricing
       WHERE supplier_id IN (${placeholders})
         AND category_l2 = ?
         AND region = ?
         AND min_quantity <= ?
         AND max_quantity >= ?`,
      [...activeIds, request.category_l2, region, request.quantity, request.quantity],
    );

    if (pricingRows.length > 0) {
      const minPrice = Math.min(...pricingRows.map((p) => p.unit_price * request.quantity!));
      const minPriceRow = pricingRows.find((p) => p.unit_price * request.quantity! === minPrice)!;

      if (minPrice > request.budget_amount) {
        await emitIssue({
          severity:        "critical",
          type:            "budget_insufficient",
          description:     `Budget of ${request.currency} ${request.budget_amount.toLocaleString()} cannot cover ${request.quantity} units. Lowest available total is ${request.currency} ${minPrice.toLocaleString()} (${minPriceRow.supplier_id}, ${request.currency} ${minPriceRow.unit_price}/unit).`,
          action_required: `Requester must increase budget to at least ${request.currency} ${minPrice.toLocaleString()} or reduce quantity.`,
        });
      }

      // 5. Lead time feasibility
      if (request.required_by_date) {
        const daysAvailable = Math.round(
          (new Date(request.required_by_date).getTime() - Date.now()) / 86_400_000,
        );
        const minStandardLt  = Math.min(...pricingRows.map((p) => p.standard_lead_time_days));
        const minExpeditedLt = Math.min(...pricingRows.map((p) => p.expedited_lead_time_days ?? Infinity));

        if (daysAvailable < minStandardLt && daysAvailable < minExpeditedLt) {
          await emitIssue({
            severity:        "high",
            type:            "lead_time_infeasible",
            description:     `Required delivery in ${daysAvailable} day(s). Minimum standard lead time: ${minStandardLt} days; expedited: ${minExpeditedLt === Infinity ? "N/A" : minExpeditedLt + " days"}. No supplier can meet the deadline.`,
            action_required: "Requester must confirm whether the delivery date is flexible.",
          });
        } else if (daysAvailable < minStandardLt && daysAvailable >= minExpeditedLt) {
          await emitIssue({
            severity:        "medium",
            type:            "expedited_required",
            description:     `Standard lead time (${minStandardLt} days) exceeds the ${daysAvailable}-day window. Expedited delivery (${minExpeditedLt} days) is available at a premium.`,
            action_required: "Confirm budget covers expedited pricing (~8% premium).",
          });
        }
      }
    }
  }

  // 6. Insufficient quotes
  if (threshold && active.length < threshold.min_supplier_quotes) {
    await emitIssue({
      severity:        "high",
      type:            "insufficient_quotes",
      description:     `Policy ${threshold.threshold_id} requires ${threshold.min_supplier_quotes} compliant quote(s) but only ${active.length} eligible supplier(s) remain.`,
      action_required: `Escalate to ${threshold.deviation_approval_required_from[0] ?? "Procurement Manager"} for deviation approval.`,
    });
  }

  // 7. Data residency constraint unmet
  if (request.data_residency_constraint) {
    const nonResidencySuppliers = active.filter((s) => !s.data_residency_supported);
    for (const s of nonResidencySuppliers) {
      state.flagged.push({ supplierId: s.supplier_id, flag: "Data residency not supported", severity: "warn" });
      await emit({ type: "SUPPLIER_FLAGGED", data: { supplierId: s.supplier_id, name: s.supplier_name, flag: "Data residency not supported by this supplier", severity: "warn" } });
    }
  }
}
