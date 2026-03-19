/**
 * SERVER-ONLY — batch rule evaluator using OpenAI.
 *
 * All rules for a pipeline step are sent in one call so latency stays low.
 * Returns typed actions that pipeline steps can execute directly.
 */
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RuleInput {
  rule_id:            string;
  rule_type?:         string;
  rule_text:          string;
  trigger_condition?: string; // for escalation rules (from DB column)
  escalate_to?:       string; // for escalation rules
}

export interface EvalSupplier {
  supplier_id:              string;
  supplier_name:            string;
  data_residency_supported: boolean;
  esg_score:                number;
  quality_score:            number;
  risk_score:               number;
  capacity_per_month?:      number;
  service_regions:          string;
}

export interface EvalContext {
  request: {
    category_l1:                  string;
    category_l2:                  string;
    budget_amount:                number | null;
    currency:                     string;
    quantity:                     number | null;
    delivery_countries:           string[];
    required_by_date?:            string;
    days_until_required?:         number | null;
    data_residency_constraint:    boolean;
    esg_requirement:              boolean;
    preferred_supplier_mentioned?: string;
    incumbent_supplier?:          string;
    business_unit:                string;
    country:                      string;
  };
  active_suppliers:  EvalSupplier[];
  pipeline_state: {
    active_count:         number;
    eliminated_count:     number;
    flagged_supplier_ids: string[];
    validation_issues:    Array<{ type: string; severity: string }>;
    threshold_id?:        string;
    threshold_min_quotes?: number;
    shortlist:            Array<{ supplier_id: string; supplier_name: string; rank: number }>;
    existing_escalation_rule_ids: string[];
  };
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type RuleAction = "none" | "validate" | "eliminate_suppliers" | "flag_supplier" | "escalate";

export interface RuleEvaluation {
  rule_id:               string;
  applies:               boolean;
  reason:                string;
  action:                RuleAction;
  // for eliminate_suppliers / flag_supplier
  affected_supplier_ids?: string[];
  flag_message?:         string;
  // for validate
  validation_severity?:  "critical" | "high" | "medium" | "low";
  validation_message?:   string;
  action_required?:      string;
  // for escalate
  escalation_blocking?:  boolean;
  escalate_to?:          string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a procurement policy rule evaluator embedded in a sourcing pipeline.

Given a JSON context (request details + active suppliers + pipeline state) and a list of rules, evaluate each rule and determine:
1. Does this rule apply to this specific request? (check both geographic/category scope AND the exact condition stated in the rule text)
2. If it applies, what concrete action must be taken?

Return ONLY a JSON object:
{
  "evaluations": [
    {
      "rule_id": "string",
      "applies": true|false,
      "reason": "1-2 sentence explanation of why it applies or not",
      "action": "none" | "validate" | "eliminate_suppliers" | "flag_supplier" | "escalate",
      "affected_supplier_ids": ["SUP-xxxx"],  // only for eliminate_suppliers / flag_supplier; ONLY use IDs from active_suppliers
      "flag_message": "string",               // for flag_supplier
      "validation_severity": "critical" | "high" | "medium" | "low",  // for validate
      "validation_message": "string",         // for validate — human-readable issue text
      "action_required": "string",            // for validate — what the requester must do
      "escalation_blocking": true|false,      // for escalate — does this block the award?
      "escalate_to": "string"                 // for escalate — use rule's escalate_to if provided
    }
  ]
}

Strict rules:
- Set "applies: false" if the rule's numeric/boolean condition is NOT met (e.g., a threshold rule only applies if the budget exceeds the stated amount).
- For "eliminate_suppliers": list only supplier IDs from the active_suppliers list that FAIL the rule's requirement. If a rule says "only use suppliers supporting X" and supplier Y does not support X, eliminate Y.
- For "flag_supplier": do NOT eliminate; use for soft warnings about specific suppliers.
- For "escalate": if trigger_condition is provided, check if the current pipeline_state matches the trigger. Use escalate_to from the rule input if present.
- For "validate": emit an issue that blocks or warns the pipeline. Only fire for conditions not already captured in validation_issues.
- Never fire an escalation with the same rule_id as one already in pipeline_state.existing_escalation_rule_ids.
- Be precise: don't fire if the stated condition is ambiguous or clearly not met.`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function evaluateRules(
  rules:   RuleInput[],
  context: EvalContext,
): Promise<RuleEvaluation[]> {
  if (rules.length === 0) return [];
  if (!process.env.OPENAI_API_KEY) return [];

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = JSON.stringify({ context, rules }, null, 0);

  try {
    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      response_format: { type: "json_object" },
      temperature:     0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "{}") as {
      evaluations?: RuleEvaluation[];
    };

    if (!Array.isArray(raw.evaluations)) return [];

    // Sanitise — ensure rule_ids match what we sent
    const validIds = new Set(rules.map((r) => r.rule_id));
    return raw.evaluations.filter((e) => validIds.has(e.rule_id));
  } catch (err) {
    // Log but don't crash the pipeline — caller will fall back to default behaviour
    console.error("[evaluateRules] OpenAI error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helper: build context from PipelineState
// ---------------------------------------------------------------------------

import type { PipelineState } from "../pipeline/types";

export function buildEvalContext(state: PipelineState): EvalContext {
  const daysUntilRequired = state.request.required_by_date
    ? Math.round((new Date(state.request.required_by_date).getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    request: {
      category_l1:                  state.request.category_l1,
      category_l2:                  state.request.category_l2,
      budget_amount:                state.request.budget_amount,
      currency:                     state.request.currency,
      quantity:                     state.request.quantity,
      delivery_countries:           state.request.delivery_countries,
      required_by_date:             state.request.required_by_date,
      days_until_required:          daysUntilRequired,
      data_residency_constraint:    state.request.data_residency_constraint,
      esg_requirement:              state.request.esg_requirement,
      preferred_supplier_mentioned: state.request.preferred_supplier_mentioned,
      incumbent_supplier:           state.request.incumbent_supplier,
      business_unit:                state.request.business_unit,
      country:                      state.request.country,
    },
    active_suppliers: state.active.map((s) => ({
      supplier_id:              s.supplier_id,
      supplier_name:            s.supplier_name,
      data_residency_supported: s.data_residency_supported,
      esg_score:                s.esg_score,
      quality_score:            s.quality_score,
      risk_score:               s.risk_score,
      capacity_per_month:       s.capacity_per_month,
      service_regions:          s.service_regions,
    })),
    pipeline_state: {
      active_count:                 state.active.length,
      eliminated_count:             state.eliminated.length,
      flagged_supplier_ids:         state.flagged.map((f) => f.supplierId),
      validation_issues:            state.validationIssues.map((v) => ({ type: v.type, severity: v.severity })),
      threshold_id:                 state.threshold?.threshold_id,
      threshold_min_quotes:         state.threshold?.min_supplier_quotes,
      shortlist:                    state.shortlist.map((s) => ({ supplier_id: s.supplier_id, supplier_name: s.supplier_name, rank: s.rank })),
      existing_escalation_rule_ids: state.escalations.map((e) => e.rule),
    },
  };
}
