import { query } from "../../db/mysql";
import type { EmitFn, FinalRecommendation, PipelineState } from "../types";

interface AwardRow {
  award_id:           string;
  supplier_name:      string;
  awarded:            number;
  award_rank:         number;
  decision_rationale: string | null;
  escalation_required: number;
  escalated_to:       string | null;
}

export async function buildRecommendation(state: PipelineState, emit: EmitFn): Promise<void> {
  const { request, shortlist, escalations, validationIssues, policiesApplied, candidates, threshold } = state;

  const blockingEscalations = escalations.filter((e) => e.blocking);
  const hasBlocking         = blockingEscalations.length > 0;
  const hasCriticalIssues   = validationIssues.some((i) => i.severity === "critical");

  let status: FinalRecommendation["status"];
  if (hasBlocking || hasCriticalIssues) {
    status = "cannot_proceed";
  } else if (escalations.length > 0) {
    status = "escalation_required";
  } else {
    status = "can_proceed";
  }

  let reason: string;
  if (status === "cannot_proceed") {
    const reasons = blockingEscalations.map((e) => e.trigger);
    reason = `${reasons.length} blocking issue(s) prevent autonomous award: ${reasons.join("; ")}.`;
  } else if (status === "escalation_required") {
    reason = `Recommendation ready but ${escalations.length} escalation(s) require human review before final award.`;
  } else {
    reason = shortlist.length > 0
      ? `${shortlist[0].supplier_name} recommended as rank 1 with score ${shortlist[0].score.toFixed(1)}.`
      : "No compliant suppliers found.";
  }

  // Historical context
  let historicalContext: string | undefined;
  if (request.request_id) {
    const awards = await query<AwardRow>(
      `SELECT award_id, supplier_name, awarded, award_rank, decision_rationale,
              escalation_required, escalated_to
       FROM historical_awards
       WHERE request_id = ?
       ORDER BY award_rank ASC`,
      [request.request_id],
    );
    if (awards.length > 0) {
      const winner = awards.find((a) => Boolean(a.awarded));
      historicalContext = winner
        ? `Historical award to ${winner.supplier_name} (${winner.decision_rationale ?? "no rationale recorded"}).`
        : `${awards.length} historical evaluation(s) found, no award recorded.`;
    }
  }

  // Min budget for budget_insufficient case
  const budgetIssue      = validationIssues.find((i) => i.type === "budget_insufficient");
  const minBudgetMatch   = budgetIssue?.description.match(/[\d,]+(?=\s*\()/);
  const minBudget        = minBudgetMatch ? parseFloat(minBudgetMatch[0].replace(/,/g, "")) : undefined;

  const recommendation: FinalRecommendation = {
    status,
    reason,
    shortlist,
    preferred_supplier_if_resolved: shortlist[0]?.supplier_name,
    minimum_budget_required:        minBudget,
    minimum_budget_currency:        minBudget ? request.currency : undefined,
    audit_trail: {
      policies_checked:       policiesApplied,
      supplier_ids_evaluated: candidates.map((s) => s.supplier_id),
      pricing_tiers_applied:  `${request.delivery_countries[0]} region, ${request.currency} currency${request.quantity ? `, qty ${request.quantity}` : ""}`,
      data_sources_used:      ["requests", "suppliers", "pricing", "policies", "historical_awards"],
      historical_context:     historicalContext,
    },
  };

  state.recommendation = recommendation;

  await emit({ type: "RECOMMENDATION", data: recommendation });
  await emit({ type: "COMPLETE", data: null });
}
