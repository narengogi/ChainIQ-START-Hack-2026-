import { NextRequest, NextResponse } from "next/server";
import { query } from "@/src/db/mysql";
import type { RankedSupplier } from "@/src/pipeline/types";

interface AwardRequest {
  /** The parsed request fields used for the pipeline run */
  request: {
    category_l1:      string;
    category_l2:      string;
    country:          string;
    business_unit:    string;
    currency:         string;
    budget_amount:    number | null;
    quantity:         number | null;
    required_by_date: string | undefined;
  };
  /** All shortlisted suppliers */
  shortlist: RankedSupplier[];
  /** The supplier the user approved (may differ from rank-1) */
  awarded_supplier_id: string;
  /** Required when user overrides rank-1 selection */
  deviation_reason?: string;
  /** Recommendation status */
  recommendation_status: "can_proceed" | "cannot_proceed" | "escalation_required";
  recommendation_reason: string;
}

function genAwardId(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand  = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HA-${today}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: AwardRequest = await req.json();
    const { request, shortlist, awarded_supplier_id, deviation_reason, recommendation_reason } = body;

    if (!shortlist.length) {
      return NextResponse.json({ error: "Empty shortlist" }, { status: 400 });
    }

    const requestId  = `REQ-${Date.now()}`;
    const awardDate  = new Date().toISOString().slice(0, 10);
    const awardedIdx = shortlist.findIndex(s => s.supplier_id === awarded_supplier_id);
    if (awardedIdx === -1) {
      return NextResponse.json({ error: "awarded_supplier_id not in shortlist" }, { status: 400 });
    }

    // Insert one row per shortlisted supplier
    for (const s of shortlist) {
      const isAwarded     = s.supplier_id === awarded_supplier_id;
      const awardId       = genAwardId();
      const totalValue    = s.total_price ?? (s.unit_price && request.quantity ? Number(s.unit_price) * request.quantity : 0);
      const leadTime      = s.pricing_tier?.standard_lead_time_days ?? null;
      const escalated     = body.recommendation_status === "escalation_required" ? 1 : 0;

      // Decision rationale: override reason for winner, else standard recommendation
      const rationale = isAwarded && deviation_reason
        ? `Override: ${deviation_reason} | Original recommendation: ${recommendation_reason}`
        : recommendation_reason;

      const notes = isAwarded && deviation_reason
        ? `User selected ${s.supplier_name} (rank ${s.rank}) instead of rank-1. Reason: ${deviation_reason}`
        : null;

      await query(
        `INSERT INTO historical_awards
          (award_id, request_id, award_date, category_l1, category_l2,
           country, business_unit, supplier_id, supplier_name,
           total_value, currency, quantity, required_by_date,
           awarded, award_rank, decision_rationale,
           policy_compliant, preferred_supplier_used,
           escalation_required, lead_time_days, risk_score_at_award, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          awardId,
          requestId,
          awardDate,
          request.category_l1,
          request.category_l2,
          request.country || "DE",
          request.business_unit || "General",
          s.supplier_id,
          s.supplier_name,
          Number(totalValue).toFixed(2),
          s.currency || request.currency || "EUR",
          request.quantity,
          request.required_by_date || null,
          isAwarded ? 1 : 0,
          s.rank,
          rationale,
          s.policy_compliant ? 1 : 0,
          s.preferred_supplier ? 1 : 0,
          escalated,
          leadTime,
          s.risk_score ?? null,
          notes,
        ],
      );
    }

    return NextResponse.json({ success: true, request_id: requestId, awarded_supplier_id });
  } catch (err) {
    console.error("[historical-awards]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
