import { query } from "../../db/mysql";
import type { EmitFn, PipelineState, ValidationIssue } from "../types";
import { evaluateRules, buildEvalContext } from "../../lib/evaluateRules";

interface CategoryRuleRow {
  rule_id:     string;
  category_l1: string;
  category_l2: string;
  rule_type:   string;
  rule_text:   string;
}

let validationCounter = 100; // offset so IDs don't clash with step 09

export async function applyCategoryRules(state: PipelineState, emit: EmitFn): Promise<void> {
  const rows = await query<CategoryRuleRow>(
    `SELECT * FROM category_rules WHERE category_l1 = ? AND category_l2 = ?`,
    [state.request.category_l1, state.request.category_l2],
  );

  if (rows.length === 0) return;

  // ── LLM evaluation path ────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    const context = buildEvalContext(state);
    const evaluations = await evaluateRules(
      rows.map((r) => ({ rule_id: r.rule_id, rule_type: r.rule_type, rule_text: r.rule_text })),
      context,
    );

    for (const ev of evaluations) {
      const row = rows.find((r) => r.rule_id === ev.rule_id)!;

      if (!ev.applies) {
        // Rule checked but condition not met — emit as informational skip
        await emit({
          type: "POLICY_APPLIED",
          data: {
            ruleId:       row.rule_id,
            description:  `[${row.rule_type}] ${row.rule_text} — ⚪ not triggered: ${ev.reason}`,
            category:     "category",
          },
        });
        continue;
      }

      // Rule applies — always emit as policy applied with LLM verdict
      state.policiesApplied.push(row.rule_id);
      await emit({
        type: "POLICY_APPLIED",
        data: {
          ruleId:       row.rule_id,
          description:  `[${row.rule_type}] ${row.rule_text} — ✅ triggered: ${ev.reason}`,
          category:     "category",
        },
      });

      // Execute action
      switch (ev.action) {
        case "eliminate_suppliers": {
          const toEliminate = ev.affected_supplier_ids ?? [];
          for (const supplierId of toEliminate) {
            const supplier = state.active.find((s) => s.supplier_id === supplierId);
            if (!supplier) continue;
            const reason = ev.reason;
            state.eliminated.push({ supplier, reason, ruleId: row.rule_id });
            state.active = state.active.filter((s) => s.supplier_id !== supplierId);
            await emit({
              type: "SUPPLIER_ELIMINATED",
              data: { supplierId, name: supplier.supplier_name, reason, ruleId: row.rule_id, step: "Category Rule" },
            });
          }
          break;
        }

        case "flag_supplier": {
          const toFlag = ev.affected_supplier_ids ?? [];
          for (const supplierId of toFlag) {
            const supplier = state.active.find((s) => s.supplier_id === supplierId);
            if (!supplier) continue;
            const flag = ev.flag_message ?? ev.reason;
            state.flagged.push({ supplierId, flag, severity: "warn" });
            await emit({
              type: "SUPPLIER_FLAGGED",
              data: { supplierId, name: supplier.supplier_name, flag, severity: "warn" },
            });
          }
          break;
        }

        case "validate": {
          if (ev.validation_message) {
            const id   = `V-C${String(validationCounter++).padStart(3, "0")}`;
            const full: ValidationIssue = {
              issue_id:        id,
              severity:        ev.validation_severity ?? "medium",
              type:            "policy_violation",
              description:     ev.validation_message,
              action_required: ev.action_required ?? "Review policy requirement before proceeding.",
            };
            state.validationIssues.push(full);
            await emit({ type: "VALIDATION_ISSUE", data: full });
          }
          break;
        }

        case "escalate": {
          if (!state.escalations.some((e) => e.rule === row.rule_id)) {
            const esc = {
              escalation_id: `ESC-C${String(state.escalations.length + 1).padStart(3, "0")}`,
              rule:          row.rule_id,
              trigger:       ev.reason,
              escalate_to:   ev.escalate_to ?? "Procurement Manager",
              blocking:      ev.escalation_blocking ?? false,
            };
            state.escalations.push(esc);
            await emit({ type: "ESCALATION", data: esc });
          }
          break;
        }

        default:
          break;
      }
    }
    return;
  }

  // ── Fallback: no API key — emit POLICY_APPLIED for all matching rules ──────
  for (const rule of rows) {
    state.policiesApplied.push(rule.rule_id);
    await emit({
      type: "POLICY_APPLIED",
      data: { ruleId: rule.rule_id, description: `[${rule.rule_type}] ${rule.rule_text}`, category: "category" },
    });
  }
}
