import { query } from "../../db/mysql";
import type { EmitFn, PipelineState, ValidationIssue } from "../types";
import { evaluateRules, buildEvalContext } from "../../lib/evaluateRules";

interface GeoRuleRow {
  rule_id:    string;
  country:    string | null;
  region:     string | null;
  countries:  string | null;
  rule_type:  string | null;
  rule_text:  string;
  applies_to: string | null;
}

const COUNTRY_REGION: Record<string, string> = {
  DE: "EU",  FR: "EU",  NL: "EU",  BE: "EU",  AT: "EU",
  IT: "EU",  ES: "EU",  PL: "EU",  UK: "EU",  CH: "EU",
  US: "Americas", CA: "Americas", BR: "LATAM", MX: "LATAM",
  SG: "APAC", AU: "APAC", IN: "APAC", JP: "APAC",
  UAE: "MEA", ZA: "MEA",
};

let validationCounter = 200; // offset from other steps

export async function applyGeographyRules(state: PipelineState, emit: EmitFn): Promise<void> {
  const deliveryCountries = state.request.delivery_countries;
  const categoryL1        = state.request.category_l1;

  const allRules = await query<GeoRuleRow>(`SELECT * FROM geography_rules`);

  // Pre-filter: only keep rules whose geographic scope overlaps the request
  const scopedRules = allRules.filter((rule) => {
    if (rule.applies_to) {
      const appliesToList = JSON.parse(rule.applies_to) as string[];
      if (!appliesToList.includes(categoryL1)) return false;
    }

    if (rule.country) return deliveryCountries.includes(rule.country);
    if (rule.countries) {
      const ruleCountries = JSON.parse(rule.countries) as string[];
      return deliveryCountries.some((c) => ruleCountries.includes(c));
    }
    if (rule.region) {
      return deliveryCountries.some(
        (c) => COUNTRY_REGION[c] === rule.region || (COUNTRY_REGION[c] === "LATAM" && rule.region === "LATAM"),
      );
    }
    return false;
  });

  if (scopedRules.length === 0) return;

  // ── LLM evaluation path ────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    const context = buildEvalContext(state);
    const evaluations = await evaluateRules(
      scopedRules.map((r) => ({
        rule_id:   r.rule_id,
        rule_type: r.rule_type ?? "geography",
        rule_text: r.rule_text,
      })),
      context,
    );

    for (const ev of evaluations) {
      const row = scopedRules.find((r) => r.rule_id === ev.rule_id)!;

      if (!ev.applies) {
        await emit({
          type: "POLICY_APPLIED",
          data: {
            ruleId:      row.rule_id,
            description: `[${row.rule_type ?? "geography"}] ${row.rule_text} — ⚪ not triggered: ${ev.reason}`,
            category:    "geography",
          },
        });
        continue;
      }

      state.policiesApplied.push(row.rule_id);
      await emit({
        type: "POLICY_APPLIED",
        data: {
          ruleId:      row.rule_id,
          description: `[${row.rule_type ?? "geography"}] ${row.rule_text} — ✅ triggered: ${ev.reason}`,
          category:    "geography",
        },
      });

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
              data: { supplierId, name: supplier.supplier_name, reason, ruleId: row.rule_id, step: "Geography Rule" },
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
            const id   = `V-G${String(validationCounter++).padStart(3, "0")}`;
            const full: ValidationIssue = {
              issue_id:        id,
              severity:        ev.validation_severity ?? "medium",
              type:            "policy_violation",
              description:     ev.validation_message,
              action_required: ev.action_required ?? "Review geography policy before proceeding.",
            };
            state.validationIssues.push(full);
            await emit({ type: "VALIDATION_ISSUE", data: full });
          }
          break;
        }

        case "escalate": {
          if (!state.escalations.some((e) => e.rule === row.rule_id)) {
            const esc = {
              escalation_id: `ESC-G${String(state.escalations.length + 1).padStart(3, "0")}`,
              rule:          row.rule_id,
              trigger:       ev.reason,
              escalate_to:   ev.escalate_to ?? "Head of Category",
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

  // ── Fallback: no API key ───────────────────────────────────────────────────
  for (const rule of scopedRules) {
    state.policiesApplied.push(rule.rule_id);
    await emit({
      type: "POLICY_APPLIED",
      data: {
        ruleId:      rule.rule_id,
        description: `[${rule.rule_type ?? "geography"}] ${rule.rule_text}`,
        category:    "geography",
      },
    });
  }
}
