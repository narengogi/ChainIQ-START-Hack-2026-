import { query } from "../../db/mysql";
import type { ApprovalThreshold, EmitFn, PipelineState } from "../types";

interface ThresholdRow {
  threshold_id:                     string;
  currency:                         string;
  min_amount:                       number;
  max_amount:                       number | null;
  min_supplier_quotes:              number;
  managed_by:                       string;
  deviation_approval_required_from: string;
  policy_note:                      string | null;
}

export async function applyThreshold(state: PipelineState, emit: EmitFn): Promise<void> {
  const { budget_amount, currency } = state.request;
  if (budget_amount === null) return; // threshold will be evaluated in escalation check

  const rows = await query<ThresholdRow>(
    `SELECT * FROM approval_thresholds
     WHERE currency = ?
       AND min_amount <= ?
       AND (max_amount IS NULL OR max_amount >= ?)
     ORDER BY min_amount DESC
     LIMIT 1`,
    [currency, budget_amount, budget_amount],
  );

  if (rows.length === 0) return;

  const row = rows[0];
  const threshold: ApprovalThreshold = {
    threshold_id:                    row.threshold_id,
    currency:                        row.currency,
    min_amount:                      row.min_amount,
    max_amount:                      row.max_amount,
    min_supplier_quotes:             row.min_supplier_quotes,
    managed_by:                      parseJson(row.managed_by, []),
    deviation_approval_required_from: parseJson(row.deviation_approval_required_from, []),
    policy_note:                     row.policy_note ?? undefined,
  };

  state.threshold = threshold;
  state.policiesApplied.push(threshold.threshold_id);

  const approver = threshold.deviation_approval_required_from[0] ?? threshold.managed_by.join(", ");
  const description = `${threshold.threshold_id}: Budget ${currency} ${budget_amount.toLocaleString()} falls in tier ${currency} ${threshold.min_amount.toLocaleString()}–${threshold.max_amount?.toLocaleString() ?? "∞"}. Requires ${threshold.min_supplier_quotes} quote(s); approval: ${approver}`;

  await emit({
    type: "POLICY_APPLIED",
    data: { ruleId: threshold.threshold_id, description, category: "threshold" },
  });
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
