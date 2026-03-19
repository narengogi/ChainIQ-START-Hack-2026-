"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinalRecommendation, RankedSupplier, RequestInput } from "@/src/pipeline/types";

interface Props {
  recommendation:  FinalRecommendation;
  activeRequest?:  RequestInput | null;
}

type ApprovalState = "idle" | "selecting" | "reason" | "saving" | "saved";

const STATUS_CONFIG = {
  can_proceed: {
    bg:    "from-emerald-950/60 to-teal-950/40",
    border: "border-emerald-700/50",
    badge:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    icon:   "✅",
    label:  "Can Proceed",
  },
  cannot_proceed: {
    bg:    "from-red-950/60 to-rose-950/40",
    border: "border-red-800/50",
    badge:  "bg-red-500/20 text-red-300 border-red-500/40",
    icon:   "🚫",
    label:  "Cannot Proceed",
  },
  escalation_required: {
    bg:    "from-amber-950/40 to-yellow-950/30",
    border: "border-amber-800/50",
    badge:  "bg-amber-500/20 text-amber-300 border-amber-500/40",
    icon:   "⚠️",
    label:  "Escalation Required",
  },
};

export default function FinalOutput({ recommendation, activeRequest }: Props) {
  const cfg = STATUS_CONFIG[recommendation.status];
  const [selected,        setSelected]        = useState<RankedSupplier | null>(null);
  const [approvalState,   setApprovalState]   = useState<ApprovalState>("idle");
  const [approvedSupplier, setApprovedSupplier] = useState<RankedSupplier | null>(null);
  const [deviationReason, setDeviationReason] = useState("");
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  const winner = recommendation.shortlist.find(s => s.rank === 1) ?? null;
  const canApprove = recommendation.status !== "cannot_proceed" && winner !== null;

  async function saveApproval(supplier: RankedSupplier, reason?: string) {
    setApprovalState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/historical-awards", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: activeRequest ?? {},
          shortlist: recommendation.shortlist,
          awarded_supplier_id: supplier.supplier_id,
          deviation_reason: reason,
          recommendation_status: recommendation.status,
          recommendation_reason: recommendation.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setApprovedSupplier(supplier);
      setApprovalState("saved");
    } catch (err) {
      setSaveError(String(err));
      setApprovalState(approvedSupplier ? "saved" : "reason");
    }
  }

  function handleApproveWinner() {
    if (!winner) return;
    saveApproval(winner);
  }

  function handleSelectOverride(supplier: RankedSupplier) {
    setApprovedSupplier(supplier);
    setApprovalState("reason");
    setTimeout(() => reasonInputRef.current?.focus(), 100);
  }

  function handleConfirmOverride() {
    if (!approvedSupplier || !deviationReason.trim()) return;
    saveApproval(approvedSupplier, deviationReason.trim());
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`rounded-2xl border bg-gradient-to-br p-5 space-y-5 ${cfg.bg} ${cfg.border}`}
      >
        {/* Status header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
              {cfg.label}
            </span>
            <p className="text-sm text-slate-300 mt-1 leading-snug">{recommendation.reason}</p>
          </div>
        </div>

        {/* Budget constraint */}
        {recommendation.minimum_budget_required && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40">
            <span className="text-xs text-red-400">
              Minimum budget required:{" "}
              <span className="font-semibold font-mono">
                {recommendation.minimum_budget_currency}{" "}
                {recommendation.minimum_budget_required.toLocaleString()}
              </span>
            </span>
          </div>
        )}

        {/* Shortlist table */}
        {recommendation.shortlist.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier Shortlist</h4>
              <span className="text-[10px] text-slate-600">Click a row for full details</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-700/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/40">
                    {["#", "Supplier", "Total", "Unit", "Lead", "Exp. Lead", "Quality", "Risk", "ESG", "Score"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recommendation.shortlist.map((s) => (
                    <motion.tr
                      key={s.supplier_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: s.rank * 0.08 }}
                      onClick={() => setSelected(s)}
                      className={`border-b border-slate-800/60 cursor-pointer transition-colors group ${
                        s.rank === 1 ? "bg-teal-950/30 hover:bg-teal-900/30" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-bold text-slate-400">
                        {s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-200 group-hover:text-white transition-colors">{s.supplier_name}</div>
                        <div className="text-[10px] text-slate-500 flex gap-1 flex-wrap mt-0.5">
                          {s.preferred_supplier && <span className="px-1 rounded bg-emerald-900/40 text-emerald-400">preferred</span>}
                          {s.flags.map((f) => (
                            <span key={f} className="px-1 rounded bg-slate-700/50 text-slate-400">{f}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 font-mono whitespace-nowrap">
                        {s.total_price != null
                          ? new Intl.NumberFormat("en-US", { style: "currency", currency: s.currency, maximumFractionDigits: 0 }).format(Number(s.total_price))
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                        {s.unit_price != null ? `${s.currency} ${Number(s.unit_price).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {s.pricing_tier ? `${s.pricing_tier.standard_lead_time_days}d` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {s.pricing_tier?.expedited_lead_time_days ? `${s.pricing_tier.expedited_lead_time_days}d` : "—"}
                      </td>
                      <td className="px-3 py-2.5"><ScorePill value={s.quality_score} color="text-emerald-400" /></td>
                      <td className="px-3 py-2.5"><ScorePill value={s.risk_score}    color="text-orange-400" /></td>
                      <td className="px-3 py-2.5"><ScorePill value={s.esg_score}     color="text-teal-400" /></td>
                      <td className="px-3 py-2.5 font-semibold text-ciq-400 font-mono">{s.score.toFixed(1)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit trail */}
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Audit Trail
          </summary>
          <div className="mt-2 p-3 rounded-xl bg-slate-900/60 border border-slate-700/40 space-y-2">
            <AuditRow label="Policies checked"       value={recommendation.audit_trail.policies_checked.join(", ") || "—"} />
            <AuditRow label="Suppliers evaluated"    value={recommendation.audit_trail.supplier_ids_evaluated.join(", ") || "—"} />
            <AuditRow label="Pricing tiers applied"  value={recommendation.audit_trail.pricing_tiers_applied} />
            <AuditRow label="Data sources"           value={recommendation.audit_trail.data_sources_used.join(", ")} />
            {recommendation.audit_trail.historical_context && (
              <AuditRow label="Historical context" value={recommendation.audit_trail.historical_context} />
            )}
          </div>
        </details>

        {/* ── Approval panel ─────────────────────────────────────────────── */}
        {canApprove && (
          <div className="border-t border-slate-700/50 pt-4 space-y-3">

            {/* Saved */}
            <AnimatePresence>
              {approvalState === "saved" && approvedSupplier && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl p-3 bg-emerald-950/40 border border-emerald-700/40"
                >
                  <span className="text-emerald-400 text-base">✓</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Award saved to historical records</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {approvedSupplier.supplier_name} — {approvedSupplier.rank === 1 ? "top-ranked selection" : `rank #${approvedSupplier.rank} override`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {saveError && (
              <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">{saveError}</p>
            )}

            {/* Idle / selecting */}
            {(approvalState === "idle" || approvalState === "selecting") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">Approve &amp; Record Decision</p>

                {/* Approve top recommendation */}
                <button
                  onClick={handleApproveWinner}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all"
                  style={{ background: "var(--ciq-red)" }}
                  type="button"
                >
                  <span>Approve {winner!.supplier_name}</span>
                  <span className="text-xs font-normal opacity-80">🥇 Recommended</span>
                </button>

                {/* Override: select a different supplier */}
                {recommendation.shortlist.length > 1 && (
                  <div>
                    <button
                      onClick={() => setApprovalState(approvalState === "selecting" ? "idle" : "selecting")}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                      type="button"
                    >
                      <span className={`transition-transform inline-block ${approvalState === "selecting" ? "rotate-90" : ""}`}>▶</span>
                      Select a different supplier
                    </button>

                    <AnimatePresence>
                      {approvalState === "selecting" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1.5">
                            {recommendation.shortlist.filter(s => s.rank !== 1).map(s => (
                              <button
                                key={s.supplier_id}
                                onClick={() => handleSelectOverride(s)}
                                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs border text-slate-300 hover:text-white transition-all text-left"
                                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                                type="button"
                              >
                                <span className="font-medium">{s.supplier_name}</span>
                                <span className="text-slate-500">
                                  #{s.rank} · {s.score.toFixed(1)} pts
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {/* Reason input for override */}
            <AnimatePresence>
              {approvalState === "reason" && approvedSupplier && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 rounded-xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <p className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                    <span>⚠</span>
                    You selected <span className="text-white">{approvedSupplier.supplier_name}</span> (rank #{approvedSupplier.rank}) instead of the top recommendation
                  </p>
                  <p className="text-[10px] text-slate-500">Please provide a reason for this override. It will be stored for audit and future model training.</p>
                  <textarea
                    ref={reasonInputRef}
                    value={deviationReason}
                    onChange={(e) => setDeviationReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Existing relationship with supplier, specific capability required, budget constraints…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ciq-600 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmOverride}
                      disabled={!deviationReason.trim() || approvalState === "saving"}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--ciq-red)" }}
                      type="button"
                    >
                      {approvalState === "saving" ? "Saving…" : "Confirm Override & Save"}
                    </button>
                    <button
                      onClick={() => { setApprovalState("idle"); setApprovedSupplier(null); setDeviationReason(""); }}
                      className="px-4 py-2 rounded-xl text-xs border text-slate-400 hover:text-slate-200 transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Saving spinner */}
            {approvalState === "saving" && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
                Saving to historical records…
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Supplier detail modal */}
      <AnimatePresence>
        {selected && (
          <SupplierModal
            supplier={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Supplier Detail Modal ───────────────────────────────────────────────────

function SupplierModal({ supplier: s, onClose }: { supplier: RankedSupplier; onClose: () => void }) {
  const rankMedal = s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`;

  const expeditedTotal = s.pricing_tier?.expedited_unit_price != null && s.pricing_tier?.min_quantity != null
    ? null // we don't have quantity here, show unit only
    : null;
  void expeditedTotal;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: 40, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto bg-slate-950 border-l border-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 px-5 py-4 border-b border-slate-800 bg-slate-950/95 backdrop-blur flex items-start justify-between gap-3`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{rankMedal}</span>
              <h2 className="text-base font-semibold text-white">{s.supplier_name}</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge color="slate">{s.supplier_id}</Badge>
              {s.preferred_supplier  && <Badge color="emerald">⭐ Preferred</Badge>}
              {s.policy_compliant    && <Badge color="teal">✓ Policy Compliant</Badge>}
              {!s.policy_compliant   && <Badge color="red">✗ Not Compliant</Badge>}
              {s.is_restricted       && <Badge color="red">🚫 Restricted</Badge>}
              {s.data_residency_supported && <Badge color="violet">🔒 Data Residency</Badge>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none shrink-0 mt-0.5"
          >×</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Recommendation note */}
          {s.recommendation_note && (
            <div className="p-3 rounded-xl bg-ciq-600/20 border border-ciq-600/20">
              <p className="text-[10px] font-semibold text-ciq-400 uppercase tracking-wide mb-1">Recommendation Note</p>
              <p className="text-xs text-slate-300 leading-relaxed">{s.recommendation_note}</p>
            </div>
          )}

          {/* Pricing */}
          <Section title="💰 Pricing" icon="">
            <DetailGrid>
              <DetailItem label="Pricing Tier" value={
                s.pricing_tier
                  ? `${s.pricing_tier.min_quantity}–${s.pricing_tier.max_quantity} units`
                  : "—"
              } mono />
              <DetailItem label="Currency"    value={s.currency} mono />
              <DetailItem label="Unit Price"  value={s.unit_price != null ? `${s.currency} ${Number(s.unit_price).toFixed(2)}` : "—"} mono />
              <DetailItem label="Total Price" value={
                s.total_price != null
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: s.currency, maximumFractionDigits: 0 }).format(Number(s.total_price))
                  : "—"
              } mono highlight />
              <DetailItem label="MOQ"         value={s.pricing_tier?.moq != null ? String(s.pricing_tier.moq) : "—"} mono />
              <DetailItem label="Pricing Model" value={s.pricing_model} />
            </DetailGrid>

            {/* Expedited pricing sub-section */}
            {s.pricing_tier?.expedited_unit_price != null && (
              <div className="mt-3 p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Expedited Pricing</p>
                <DetailGrid>
                  <DetailItem label="Expedited Unit Price" value={`${s.currency} ${Number(s.pricing_tier.expedited_unit_price).toFixed(2)}`} mono />
                  <DetailItem label="Premium vs Standard"  value={
                    s.unit_price != null
                      ? `+${(((Number(s.pricing_tier.expedited_unit_price) - Number(s.unit_price)) / Number(s.unit_price)) * 100).toFixed(1)}%`
                      : "—"
                  } mono />
                </DetailGrid>
              </div>
            )}
          </Section>

          {/* Lead Times */}
          <Section title="⏱ Lead Times" icon="">
            <DetailGrid>
              <DetailItem
                label="Standard Lead Time"
                value={s.pricing_tier?.standard_lead_time_days != null ? `${s.pricing_tier.standard_lead_time_days} days` : "—"}
                mono
              />
              <DetailItem
                label="Expedited Lead Time"
                value={s.pricing_tier?.expedited_lead_time_days != null ? `${s.pricing_tier.expedited_lead_time_days} days` : "Not available"}
                mono
              />
            </DetailGrid>
          </Section>

          {/* Scores */}
          <Section title="📊 Scores" icon="">
            <div className="space-y-2">
              <ScoreBar label="Quality Score"    value={s.quality_score}   color="bg-emerald-500" />
              <ScoreBar label="Risk Score"       value={s.risk_score}      color="bg-orange-500"  invert />
              <ScoreBar label="ESG Score"        value={s.esg_score}       color="bg-teal-500" />
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-2">
                <span className="text-[11px] text-slate-400 font-medium">Composite Score</span>
                <span className="text-sm font-bold text-ciq-400 font-mono">{s.score.toFixed(1)}</span>
              </div>
            </div>
          </Section>

          {/* Supplier Profile */}
          <Section title="🏢 Supplier Profile" icon="">
            <DetailGrid>
              <DetailItem label="HQ Country"           value={s.country_hq} />
              <DetailItem label="Contract Status"      value={s.contract_status} />
              <DetailItem label="Category L1"          value={s.category_l1} />
              <DetailItem label="Category L2"          value={s.category_l2} />
              <DetailItem
                label="Capacity / Month"
                value={s.capacity_per_month != null ? `${s.capacity_per_month.toLocaleString()} units` : "Not specified"}
                mono
              />
              <DetailItem
                label="Data Residency"
                value={s.data_residency_supported ? "Supported" : "Not supported"}
                highlight={s.data_residency_supported}
              />
            </DetailGrid>
            <div className="mt-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Service Regions</p>
              <div className="flex flex-wrap gap-1.5">
                {s.service_regions.split(";").map((r) => r.trim()).filter(Boolean).map((r) => (
                  <span key={r} className="text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </Section>

          {/* Flags */}
          {(s.flags.length > 0 || s.restriction_reason) && (
            <Section title="🚩 Flags & Restrictions" icon="">
              <div className="space-y-1.5">
                {s.flags.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs text-yellow-300 bg-yellow-950/20 border border-yellow-900/30 rounded-lg px-2.5 py-1.5">
                    <span className="text-yellow-500 shrink-0 mt-0.5">⚠</span>
                    {f}
                  </div>
                ))}
                {s.restriction_reason && (
                  <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/30 rounded-lg px-2.5 py-1.5">
                    <span className="text-red-500 shrink-0 mt-0.5">🚫</span>
                    {s.restriction_reason}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-3">
        {children}
      </div>
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>;
}

function DetailItem({
  label, value, mono = false, highlight = false,
}: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none mb-0.5">{label}</p>
      <p className={`text-xs leading-snug ${mono ? "font-mono" : ""} ${highlight ? "text-emerald-300 font-semibold" : "text-slate-200"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function ScoreBar({
  label, value, color, invert = false,
}: { label: string; value: number; color: string; invert?: boolean }) {
  const pct     = Math.min(100, Math.max(0, value));
  const display = invert ? `${value} (lower is better)` : String(value);
  const barPct  = invert ? 100 - pct : pct;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-[11px] font-mono text-slate-300 w-20 shrink-0 text-right">{display}</span>
    </div>
  );
}

function Badge({ color, children }: { color: "slate" | "emerald" | "teal" | "red" | "violet"; children: React.ReactNode }) {
  const cls = {
    slate:   "bg-slate-800 border-slate-700 text-slate-400",
    emerald: "bg-emerald-900/40 border-emerald-700/40 text-emerald-300",
    teal:    "bg-teal-900/40 border-teal-700/40 text-teal-300",
    red:     "bg-red-900/40 border-red-700/40 text-red-300",
    violet:  "bg-violet-900/40 border-violet-700/40 text-violet-300",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

function ScorePill({ value, color }: { value: number; color: string }) {
  return <span className={`font-mono ${color}`}>{value}</span>;
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <p className="text-xs text-slate-300 font-mono break-words">{value}</p>
    </div>
  );
}
