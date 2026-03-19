import { query } from "../../db/mysql";
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

export async function fetchCandidates(state: PipelineState, emit: EmitFn): Promise<void> {
  const rows = await query<SupplierRow>(
    `SELECT * FROM suppliers
     WHERE category_l2 = ?
       AND contract_status = 'active'`,
    [state.request.category_l2],
  );

  const suppliers: CandidateSupplier[] = rows.map((r) => ({
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
  }));

  state.candidates = suppliers;
  state.active     = [...suppliers];

  await emit({
    type: "CANDIDATE_POOL",
    data: { suppliers, count: suppliers.length },
  });
}
