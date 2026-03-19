"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CandidateSupplier, Escalation, PipelineEvent, RankedSupplier } from "@/src/pipeline/types";
import SupplierCard from "./SupplierCard";
import EventLog from "./EventLog";
import EscalationAlert from "./EscalationAlert";

interface Props {
  events: PipelineEvent[];
}

interface SupplierState {
  supplier:    CandidateSupplier;
  eliminated?: { reason: string; ruleId?: string };
  flags:       { flag: string; severity: "warn" | "info" }[];
  ranked?:     RankedSupplier;
}

export default function RaceTrack({ events }: Props) {
  const supplierMap = useMemo(() => {
    const map = new Map<string, SupplierState>();

    for (const ev of events) {
      if (ev.type === "CANDIDATE_POOL") {
        for (const s of ev.data.suppliers) {
          map.set(s.supplier_id, { supplier: s, flags: [] });
        }
      } else if (ev.type === "SUPPLIER_ELIMINATED") {
        const existing = map.get(ev.data.supplierId);
        if (existing) {
          map.set(ev.data.supplierId, {
            ...existing,
            eliminated: { reason: ev.data.reason, ruleId: ev.data.ruleId },
          });
        }
      } else if (ev.type === "SUPPLIER_FLAGGED") {
        const existing = map.get(ev.data.supplierId);
        if (existing) {
          map.set(ev.data.supplierId, {
            ...existing,
            flags: [...existing.flags, { flag: ev.data.flag, severity: ev.data.severity }],
          });
        }
      } else if (ev.type === "SHORTLIST") {
        for (const ranked of ev.data.suppliers) {
          const existing = map.get(ranked.supplier_id);
          if (existing) {
            map.set(ranked.supplier_id, { ...existing, ranked });
          }
        }
      }
    }

    return map;
  }, [events]);

  const escalations = useMemo<Escalation[]>(() => {
    return events
      .filter((e): e is Extract<PipelineEvent, { type: "ESCALATION" }> => e.type === "ESCALATION")
      .map((e) => e.data);
  }, [events]);

  const validationIssues = useMemo(() => {
    return events
      .filter((e): e is Extract<PipelineEvent, { type: "VALIDATION_ISSUE" }> => e.type === "VALIDATION_ISSUE")
      .map((e) => e.data);
  }, [events]);

  const policiesApplied = useMemo(() => {
    return events
      .filter((e): e is Extract<PipelineEvent, { type: "POLICY_APPLIED" }> => e.type === "POLICY_APPLIED")
      .map((e) => e.data);
  }, [events]);

  const stageSummaries = useMemo(() => {
    return events
      .filter((e): e is Extract<PipelineEvent, { type: "STAGE_SUMMARY" }> => e.type === "STAGE_SUMMARY")
      .map((e) => e.data);
  }, [events]);

  const candidateCount = useMemo(() => {
    const pool = events.find((e): e is Extract<PipelineEvent, { type: "CANDIDATE_POOL" }> => e.type === "CANDIDATE_POOL");
    return pool?.data.count ?? null;
  }, [events]);

  const activeSuppliers   = [...supplierMap.values()].filter((s) => !s.eliminated);
  const eliminatedSuppliers = [...supplierMap.values()].filter((s) => s.eliminated);
  const isComplete = events.some((e) => e.type === "COMPLETE");
  const hasPool    = events.some((e) => e.type === "CANDIDATE_POOL");

  if (!hasPool) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        Submit a request to start the pipeline
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stage indicator */}
      <PipelineProgress events={events} />

      {/* Supplier funnel */}
      {(candidateCount !== null || stageSummaries.length > 0) && (
        <SupplierFunnel candidateCount={candidateCount} stages={stageSummaries} isComplete={isComplete} activeCount={activeSuppliers.length} />
      )}

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <section>
          <SectionTitle icon="⚡" label="Validation Issues" count={validationIssues.length} />
          <div className="space-y-2">
            {validationIssues.map((issue) => (
              <motion.div
                key={issue.issue_id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border text-xs leading-snug ${
                  issue.severity === "critical"
                    ? "bg-red-950/50 border-red-800/50 text-red-300"
                    : issue.severity === "high"
                      ? "bg-orange-950/40 border-orange-800/40 text-orange-300"
                      : issue.severity === "medium"
                        ? "bg-yellow-950/30 border-yellow-800/30 text-yellow-300"
                        : "bg-slate-800/40 border-slate-700/40 text-slate-400"
                }`}
              >
                <span className="font-semibold font-mono">[{issue.issue_id}] </span>
                {issue.description}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Escalations */}
      {escalations.length > 0 && (
        <section>
          <SectionTitle icon="🚨" label="Escalations" count={escalations.length} />
          <EscalationAlert escalations={escalations} />
        </section>
      )}

      {/* Race — Active suppliers */}
      {activeSuppliers.length > 0 && (
        <section>
          <SectionTitle
            icon="🏁"
            label={isComplete ? "Final Shortlist" : "In Race"}
            count={activeSuppliers.length}
            accent={isComplete ? "text-teal-400" : "text-sky-400"}
          />
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence>
              {activeSuppliers.map((s) => (
                <SupplierCard
                  key={s.supplier.supplier_id}
                  supplier={s.supplier}
                  flags={s.flags}
                  ranked={s.ranked}
                  isWinner={s.ranked?.rank === 1 && isComplete}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </section>
      )}

      {/* Eliminated suppliers — grouped by step */}
      {eliminatedSuppliers.length > 0 && (
        <EliminatedSection eliminatedSuppliers={eliminatedSuppliers} />
      )}

      {/* Policies applied */}
      {policiesApplied.length > 0 && (
        <section>
          <SectionTitle icon="📋" label="Policies Applied" count={policiesApplied.length} accent="text-emerald-400" />
          <div className="space-y-1.5">
            {policiesApplied.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30"
              >
                <span className="text-[10px] font-mono font-semibold text-emerald-500 shrink-0 mt-0.5">{p.ruleId}</span>
                <span className="text-xs text-slate-400 leading-snug">{p.description}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Pipeline Progress Bar ──────────────────────────────────────────────────

const STAGES = [
  { key: "REQUEST_PARSED",    label: "Parse" },
  { key: "CANDIDATE_POOL",    label: "Pool" },
  { key: "SUPPLIER_ELIMINATED", label: "Filter" },
  { key: "POLICY_APPLIED",    label: "Policy" },
  { key: "VALIDATION_ISSUE",  label: "Validate" },
  { key: "SHORTLIST",         label: "Rank" },
  { key: "ESCALATION",        label: "Escalate" },
  { key: "RECOMMENDATION",    label: "Decide" },
  { key: "COMPLETE",          label: "Done" },
];

function PipelineProgress({ events }: { events: PipelineEvent[] }) {
  const seenTypes = new Set(events.map((e) => e.type));
  const currentIdx = STAGES.reduce((acc, stage, i) => (seenTypes.has(stage.key as PipelineEvent["type"]) ? i : acc), -1);

  return (
    <div className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const done   = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300 ${
                done ? "bg-sky-500 text-white" : "bg-slate-700 text-slate-500"
              } ${active ? "ring-2 ring-sky-400/50 ring-offset-1 ring-offset-slate-900" : ""}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] mt-0.5 transition-colors ${done ? "text-sky-400" : "text-slate-600"}`}>{stage.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 mx-0.5 rounded transition-colors duration-500 ${i < currentIdx ? "bg-sky-500" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Supplier Funnel ────────────────────────────────────────────────────────

interface StageSummaryData { stage: string; step: number; activeCount: number; eliminatedThisStep: number; totalEliminated: number }

function SupplierFunnel({
  candidateCount,
  stages,
  isComplete,
  activeCount,
}: {
  candidateCount: number | null;
  stages: StageSummaryData[];
  isComplete: boolean;
  activeCount: number;
}) {
  const steps: { label: string; count: number; eliminated: number; color: string }[] = [];

  if (candidateCount !== null) {
    steps.push({ label: "Pool", count: candidateCount, eliminated: 0, color: "text-sky-400" });
  }
  for (const s of stages) {
    steps.push({
      label: s.stage.replace(" Filter", ""),
      count: s.activeCount,
      eliminated: s.eliminatedThisStep,
      color: s.eliminatedThisStep > 0 ? "text-red-400" : "text-emerald-400",
    });
  }
  if (isComplete && steps.length > 0) {
    steps.push({ label: "Shortlist", count: activeCount, eliminated: 0, color: "text-teal-400" });
  }

  if (steps.length < 2) return null;

  const maxCount = steps[0]?.count ?? 1;

  return (
    <section>
      <SectionTitle icon="🔻" label="Supplier Funnel" accent="text-slate-400" />
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <span className="text-[10px] text-slate-500 w-20 shrink-0 text-right leading-none">{s.label}</span>
            <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 + 0.1 }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold font-mono ${s.color}`}>{s.count}</span>
              {s.eliminated > 0 && (
                <span className="text-[10px] text-red-500 font-mono">−{s.eliminated}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Eliminated Section (grouped by step) ───────────────────────────────────

function EliminatedSection({ eliminatedSuppliers }: { eliminatedSuppliers: Array<{ supplier: CandidateSupplier; eliminated?: { reason: string; ruleId?: string; step?: string }; flags: { flag: string; severity: "warn" | "info" }[] }> }) {
  const byStep = eliminatedSuppliers.reduce<Record<string, typeof eliminatedSuppliers>>((acc, s) => {
    const step = s.eliminated?.step ?? "Unknown step";
    if (!acc[step]) acc[step] = [];
    acc[step].push(s);
    return acc;
  }, {});

  const steps = Object.entries(byStep);

  return (
    <section>
      <SectionTitle icon="❌" label="Eliminated" count={eliminatedSuppliers.length} accent="text-red-400" />
      <div className="space-y-4">
        {steps.map(([step, suppliers]) => (
          <div key={step}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-semibold text-red-500 bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded">{step}</span>
              <span className="text-[10px] text-slate-600">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} removed</span>
            </div>
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence>
                {suppliers.map((s) => (
                  <SupplierCard
                    key={s.supplier.supplier_id}
                    supplier={s.supplier}
                    eliminated={s.eliminated}
                    flags={s.flags}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Section Title ──────────────────────────────────────────────────────────

function SectionTitle({ icon, label, count, accent = "text-slate-400" }: { icon: string; label: string; count?: number; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h3 className={`text-sm font-semibold ${accent}`}>{label}</h3>
      {count !== undefined && (
        <span className="text-xs text-slate-600">({count})</span>
      )}
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
}
