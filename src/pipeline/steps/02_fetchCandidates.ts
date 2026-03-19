import { query } from "../../db/mysql";
import { fuzzyMatchCategory, likeMatchCategory } from "../../lib/fuzzyCategory";
import type { CandidateSupplier, EmitFn, PipelineState } from "../types";

interface SupplierRow {
  supplier_id:              string;
  supplier_name:            string;
  category_l1:              string;
  category_l2:              string;
  country_hq:               string;
  service_regions:          string;
  currency:                 string;
  pricing_model:            string;
  quality_score:            number;
  risk_score:               number;
  esg_score:                number;
  preferred_supplier:       number;
  is_restricted:            number;
  restriction_reason:       string | null;
  contract_status:          string;
  data_residency_supported: number;
  capacity_per_month:       number | null;
}

function mapRow(r: SupplierRow): CandidateSupplier {
  return {
    supplier_id:              r.supplier_id,
    supplier_name:            r.supplier_name,
    category_l1:              r.category_l1,
    category_l2:              r.category_l2,
    country_hq:               r.country_hq,
    service_regions:          r.service_regions,
    currency:                 r.currency,
    pricing_model:            r.pricing_model,
    quality_score:            Number(r.quality_score),
    risk_score:               Number(r.risk_score),
    esg_score:                Number(r.esg_score),
    preferred_supplier:       Boolean(r.preferred_supplier),
    is_restricted:            Boolean(r.is_restricted),
    restriction_reason:       r.restriction_reason ?? undefined,
    contract_status:          r.contract_status,
    data_residency_supported: Boolean(r.data_residency_supported),
    capacity_per_month:       r.capacity_per_month ?? undefined,
  };
}

export async function fetchCandidates(state: PipelineState, emit: EmitFn): Promise<void> {
  let { category_l1, category_l2 } = state.request;

  // --- exact match ---
  let rows = await query<SupplierRow>(
    `SELECT * FROM suppliers WHERE category_l2 = ? AND contract_status = 'active'`,
    [category_l2],
  );

  // --- fuzzy fallback if exact match returns nothing ---
  if (rows.length === 0) {
    const fuzzy = await fuzzyMatchCategory(category_l1, category_l2);
    const fallback = fuzzy ?? (await likeMatchCategory(category_l2));

    if (fallback) {
      const resolved_l1 = fallback.category_l1;
      const resolved_l2 = fallback.category_l2;

      // Emit an informational note so the UI shows the resolution
      await emit({
        type: "POLICY_APPLIED",
        data: {
          ruleId:      "CAT-RESOLVE",
          description: `Category "${category_l2}" not found — resolved to "${resolved_l2}" (${resolved_l1}) via fuzzy match`,
          category:    resolved_l1,
        },
      });

      // Update request so downstream steps use the corrected category
      state.request.category_l1 = resolved_l1;
      state.request.category_l2 = resolved_l2;
      category_l1 = resolved_l1;
      category_l2 = resolved_l2;

      rows = await query<SupplierRow>(
        `SELECT * FROM suppliers WHERE category_l2 = ? AND contract_status = 'active'`,
        [category_l2],
      );
    }
  }

  const suppliers: CandidateSupplier[] = rows.map(mapRow);

  state.candidates = suppliers;
  state.active     = [...suppliers];

  await emit({
    type: "CANDIDATE_POOL",
    data: { suppliers, count: suppliers.length },
  });
}
