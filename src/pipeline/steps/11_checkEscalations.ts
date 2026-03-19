import { query } from "../../db/mysql";
import type { EmitFn, Escalation, PipelineState } from "../types";
import { evaluateRules, buildEvalContext } from "../../lib/evaluateRules";

interface EscalationRuleRow {
  rule_id:               string;
  trigger_condition:     string;
  action:                string;
  escalate_to:           string;
  applies_to_currencies: string | null;
}

export async function checkEscalations(state: PipelineState, emit: EmitFn): Promise<void> {
  const { request, active, validationIssues, threshold, shortlist, flagged } = state;
  let counter = state.escalations.length + 1;

  const escalate = async (rule: string, trigger: string, escalateTo: string, blocking: boolean) => {
    // Deduplicate — never fire the same rule_id twice
    if (state.escalations.some((e) => e.rule === rule)) return;
    const esc: Escalation = {
      escalation_id: `ESC-${String(counter++).padStart(3, "0")}`,
      rule,
      trigger,
      escalate_to: escalateTo,
      blocking,
    };
    state.escalations.push(esc);
    await emit({ type: "ESCALATION", data: esc });
  };

  // ── LLM path: query DB rules and evaluate them ────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    const dbRules = await query<EscalationRuleRow>(
      `SELECT * FROM escalation_rules ORDER BY rule_id`,
    );

    if (dbRules.length > 0) {
      // Scope to applicable currencies
      const applicableRules = dbRules.filter((r) => {
        if (!r.applies_to_currencies) return true;
        try {
          const currencies = JSON.parse(r.applies_to_currencies) as string[];
          return currencies.includes(request.currency);
        } catch {
          return true;
        }
      });

      const context = buildEvalContext(state);
      const evaluations = await evaluateRules(
        applicableRules.map((r) => ({
          rule_id:           r.rule_id,
          rule_text:         r.trigger_condition,
          trigger_condition: r.trigger_condition,
          escalate_to:       r.escalate_to,
        })),
        context,
      );

      for (const ev of evaluations) {
        if (!ev.applies || ev.action !== "escalate") continue;
        const dbRule = applicableRules.find((r) => r.rule_id === ev.rule_id)!;
        await escalate(
          ev.rule_id,
          ev.reason,
          ev.escalate_to ?? dbRule.escalate_to,
          ev.escalation_blocking ?? false,
        );
      }
    }

    // Pipeline-state escalations not captured by DB rules (AT-DEVIATION, ER-LEAD)
    await checkDeviationAndLeadTime(state, escalate, threshold, shortlist, validationIssues, request);
    return;
  }

  // ── Fallback: hardcoded checks (no API key) ───────────────────────────────

  // ER-001: Missing required information
  const hasMissingInfo = validationIssues.some((i) =>
    i.type === "missing_budget" || i.type === "missing_quantity",
  );
  if (hasMissingInfo) {
    await escalate("ER-001", "Missing required information (budget or quantity not specified)", "Requester Clarification", true);
  }

  // ER-002: Preferred supplier is restricted
  if (request.preferred_supplier_mentioned) {
    const eliminatedPreferred = state.eliminated.find(
      (e) => e.supplier.supplier_name === request.preferred_supplier_mentioned && e.ruleId === "POLICY-RESTRICTED",
    );
    if (eliminatedPreferred) {
      await escalate("ER-002", `Preferred supplier "${request.preferred_supplier_mentioned}" is restricted for this category/region`, "Procurement Manager", false);
    }
  }

  // ER-003: High-value contract threshold
  const highValueThresholds = ["AT-004", "AT-005", "AT-009", "AT-010", "AT-014", "AT-015"];
  if (threshold && highValueThresholds.includes(threshold.threshold_id)) {
    await escalate("ER-003", `Contract value (${request.currency} ${request.budget_amount?.toLocaleString()}) exceeds high-value sourcing threshold ${threshold.threshold_id}`, "Head of Strategic Sourcing", false);
  }

  // ER-004: No compliant supplier found
  if (active.length === 0) {
    await escalate("ER-004", "No compliant supplier can be identified after applying all policy filters", "Head of Category", true);
  }

  // ER-005: Data residency constraint cannot be satisfied
  if (request.data_residency_constraint) {
    const residencyCapable = active.filter((s) => s.data_residency_supported);
    if (residencyCapable.length === 0) {
      await escalate("ER-005", "Data residency constraint specified but no remaining supplier supports in-country data residency", "Security and Compliance Review", true);
    }
  }

  // ER-006: Capacity risk
  const capacityFlagged = flagged.some((f) => f.flag.toLowerCase().includes("capacity"));
  if (capacityFlagged) {
    await escalate("ER-006", "Single supplier capacity risk flagged — quantity is close to or exceeds capacity limit", "Sourcing Excellence Lead", false);
  }

  // ER-007: Brand safety
  if (request.category_l1 === "Marketing" && request.category_l2 === "Influencer Campaign Management") {
    await escalate("ER-007", "Influencer Campaign Management requires brand-safety review before final award", "Marketing Governance Lead", false);
  }

  await checkDeviationAndLeadTime(state, escalate, threshold, shortlist, validationIssues, request);
}

// ---------------------------------------------------------------------------
// Shared post-processing: always runs regardless of LLM/fallback path
// ---------------------------------------------------------------------------

async function checkDeviationAndLeadTime(
  state:            PipelineState,
  escalate:         (rule: string, trigger: string, escalateTo: string, blocking: boolean) => Promise<void>,
  threshold:        PipelineState["threshold"],
  shortlist:        PipelineState["shortlist"],
  validationIssues: PipelineState["validationIssues"],
  request:          PipelineState["request"],
) {
  // AT-DEVIATION: requester-preferred supplier is not the #1 ranked
  const preferredName = request.preferred_supplier_mentioned;
  if (preferredName && shortlist.length > 0 && shortlist[0].supplier_name !== preferredName) {
    const preferredRank = shortlist.find((s) => s.supplier_name === preferredName)?.rank;
    if (preferredRank && preferredRank > 1) {
      await escalate(
        "AT-DEVIATION",
        `Requester specified "${preferredName}" but compliance scoring ranks them #${preferredRank}. Awarding to #1 (${shortlist[0].supplier_name}) unless deviation is approved.`,
        threshold?.deviation_approval_required_from[0] ?? "Procurement Manager",
        false,
      );
    }
  }

  // ER-LEAD: lead time infeasible
  const leadTimeIssue = validationIssues.find((i) => i.type === "lead_time_infeasible");
  if (leadTimeIssue) {
    await escalate("ER-LEAD", "No compliant supplier can meet the stated delivery deadline", "Head of Category", true);
  }
}
