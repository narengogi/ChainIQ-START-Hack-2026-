import type { EmitFn, PipelineState } from "../types";

export async function parseRequest(state: PipelineState, emit: EmitFn): Promise<void> {
  const r = state.request;

  const daysUntilRequired = r.required_by_date
    ? Math.round(
        (new Date(r.required_by_date).getTime() - Date.now()) / 86_400_000,
      )
    : null;

  await emit({
    type: "REQUEST_PARSED",
    data: {
      interpretation: {
        request_id:                   r.request_id,
        created_at:                   r.created_at,
        request_channel:              r.request_channel,
        request_language:             r.request_language,
        business_unit:                r.business_unit,
        country:                      r.country,
        site:                         r.site,
        requester_id:                 r.requester_id,
        requester_role:               r.requester_role,
        submitted_for_id:             r.submitted_for_id,
        category_l1:                  r.category_l1,
        category_l2:                  r.category_l2,
        title:                        r.title,
        currency:                     r.currency,
        budget_amount:                r.budget_amount,
        quantity:                     r.quantity,
        unit_of_measure:              r.unit_of_measure,
        required_by_date:             r.required_by_date,
        preferred_supplier_mentioned: r.preferred_supplier_mentioned,
        incumbent_supplier:           r.incumbent_supplier,
        contract_type_requested:      r.contract_type_requested,
        delivery_countries:           r.delivery_countries,
        data_residency_constraint:    r.data_residency_constraint,
        esg_requirement:              r.esg_requirement,
        status:                       r.status,
        scenario_tags:                r.scenario_tags,
        days_until_required:          daysUntilRequired,
      },
    },
  });
}
