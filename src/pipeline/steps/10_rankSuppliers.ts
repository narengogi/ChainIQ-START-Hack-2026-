import { query } from "../../db/mysql";
import type { EmitFn, PipelineState, PricingTier, RankedSupplier } from "../types";

interface PricingRow extends PricingTier {}

const REGION_MAP: Record<string, string> = {
  DE: "EU", FR: "EU", NL: "EU", BE: "EU", AT: "EU",
  IT: "EU", ES: "EU", PL: "EU", UK: "EU", CH: "EU",
  US: "Americas", CA: "Americas", BR: "Americas", MX: "Americas",
  SG: "APAC", AU: "APAC", IN: "APAC", JP: "APAC",
  UAE: "MEA", ZA: "MEA",
};

// Weighted composite score (lower is better for price & risk; higher is better for quality/ESG)
function compositeScore(
  unitPrice: number,
  maxPrice: number,
  quality: number,
  risk: number,
  esg: number,
  preferred: boolean,
): number {
  const priceNorm   = maxPrice > 0 ? (1 - unitPrice / maxPrice) * 100 : 50;
  const riskInverse = 100 - risk;
  const preferredBonus = preferred ? 5 : 0;
  // Weights: price 40%, quality 25%, risk 20%, esg 10%, preferred 5%
  return priceNorm * 0.4 + quality * 0.25 + riskInverse * 0.2 + esg * 0.1 + preferredBonus;
}

export async function rankSuppliers(state: PipelineState, emit: EmitFn): Promise<void> {
  if (state.active.length === 0) return;

  const { request, active, threshold } = state;
  const region = REGION_MAP[request.delivery_countries[0]] ?? "EU";

  // Get preferred supplier policy entries for this category
  interface PreferredRow { supplier_id: string }
  const preferredRows = await query<PreferredRow>(
    `SELECT supplier_id FROM preferred_suppliers
     WHERE category_l1 = ? AND category_l2 = ?`,
    [request.category_l1, request.category_l2],
  );
  const preferredIds = new Set(preferredRows.map((r) => r.supplier_id));

  // Fetch pricing tiers for all active suppliers
  const activeIds  = active.map((s) => s.supplier_id);
  const placeholders = activeIds.map(() => "?").join(",");

  const pricingRows = await query<PricingRow>(
    `SELECT pricing_id, supplier_id, region, currency,
            min_quantity, max_quantity, unit_price, moq,
            standard_lead_time_days, expedited_lead_time_days, expedited_unit_price
     FROM pricing
     WHERE supplier_id IN (${placeholders})
       AND category_l2 = ?
       AND region = ?
       ${request.quantity !== null ? "AND min_quantity <= ? AND max_quantity >= ?" : ""}`,
    request.quantity !== null
      ? [...activeIds, request.category_l2, region, request.quantity, request.quantity]
      : [...activeIds, request.category_l2, region],
  );

  const pricingBySupplier = new Map<string, PricingRow>();
  for (const row of pricingRows) {
    // MySQL returns DECIMAL columns as strings — coerce all numeric fields
    pricingBySupplier.set(row.supplier_id, {
      ...row,
      unit_price:               Number(row.unit_price),
      expedited_unit_price:     row.expedited_unit_price != null ? Number(row.expedited_unit_price) : undefined,
      standard_lead_time_days:  Number(row.standard_lead_time_days),
      expedited_lead_time_days: row.expedited_lead_time_days != null ? Number(row.expedited_lead_time_days) : undefined,
      min_quantity:             Number(row.min_quantity),
      max_quantity:             Number(row.max_quantity),
      moq:                      Number(row.moq),
    });
  }

  // Build unit prices list to normalise score
  const unitPrices = active
    .map((s) => pricingBySupplier.get(s.supplier_id)?.unit_price ?? 0)
    .filter((p) => p > 0);
  const maxUnitPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : 1;

  const ranked: RankedSupplier[] = active.map((supplier) => {
    const pricing = pricingBySupplier.get(supplier.supplier_id) ?? null;
    const unitPrice   = pricing?.unit_price != null ? Number(pricing.unit_price) : null;
    const totalPrice  = unitPrice !== null && request.quantity !== null
      ? unitPrice * Number(request.quantity)
      : null;

    const score = compositeScore(
      unitPrice ?? maxUnitPrice,
      maxUnitPrice,
      supplier.quality_score,
      supplier.risk_score,
      supplier.esg_score,
      preferredIds.has(supplier.supplier_id) || supplier.preferred_supplier,
    );

    const flags: string[] = [];
    if (preferredIds.has(supplier.supplier_id)) flags.push("preferred");
    if (supplier.supplier_name === request.incumbent_supplier)    flags.push("incumbent");
    if (supplier.supplier_name === request.preferred_supplier_mentioned) flags.push("requester-preferred");

    const note = buildNote(supplier, pricing, request.preferred_supplier_mentioned, request.incumbent_supplier);

    return {
      ...supplier,
      rank:               0, // set after sort
      pricing_tier:       pricing,
      unit_price:         unitPrice,
      total_price:        totalPrice,
      score,
      policy_compliant:   true,
      recommendation_note: note,
      flags,
    };
  });

  // Sort by score descending, assign ranks
  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((s, i) => (s.rank = i + 1));

  state.shortlist = ranked;

  const quotesRequired = threshold?.min_supplier_quotes ?? 1;
  const approver = threshold
    ? (threshold.deviation_approval_required_from[0] ?? threshold.managed_by.join(", "))
    : "Business";

  await emit({
    type: "SHORTLIST",
    data: { suppliers: ranked, quotesRequired, approver },
  });
}

function buildNote(
  s: { supplier_name: string; quality_score: number; risk_score: number },
  pricing: PricingTier | null,
  preferredMentioned?: string,
  incumbent?: string,
): string {
  const parts: string[] = [];
  if (s.supplier_name === preferredMentioned) parts.push("Requester's preferred supplier");
  if (s.supplier_name === incumbent)          parts.push("Incumbent supplier");
  if (pricing)                                parts.push(`Lead time: ${pricing.standard_lead_time_days}d standard`);
  parts.push(`Quality: ${s.quality_score}, Risk: ${s.risk_score}`);
  return parts.join(". ");
}
