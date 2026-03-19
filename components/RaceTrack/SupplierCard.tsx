"use client";

import { motion } from "framer-motion";
import type { CandidateSupplier, RankedSupplier } from "@/src/pipeline/types";

interface EliminatedInfo {
  reason: string;
  ruleId?: string;
}

interface FlagInfo {
  flag:     string;
  severity: "warn" | "info";
}

interface Props {
  supplier:    CandidateSupplier;
  eliminated?: EliminatedInfo;
  flags?:      FlagInfo[];
  ranked?:     RankedSupplier;
  isWinner?:   boolean;
}

const RANK_COLORS: Record<number, string> = {
  1: "from-yellow-400/20 to-yellow-600/10 border-yellow-500/50",
  2: "from-slate-300/10 to-slate-500/5  border-slate-400/40",
  3: "from-amber-700/15 to-amber-900/5  border-amber-600/40",
};

const RANK_LABELS: Record<number, string> = { 1: "🥇 1st", 2: "🥈 2nd", 3: "🥉 3rd" };

export default function SupplierCard({ supplier, eliminated, flags = [], ranked, isWinner }: Props) {
  const isEliminated = Boolean(eliminated);
  const rank         = ranked?.rank;

  const borderClass = isEliminated
    ? "border-red-900/50"
    : rank && RANK_COLORS[rank]
      ? RANK_COLORS[rank]
      : "border-slate-700";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: isEliminated ? 0.4 : 1, y: 0, scale: isWinner ? 1.02 : 1 }}
      exit={{ opacity: 0, x: -180, rotate: -8, scale: 0.85, transition: { duration: 0.4 } }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`relative rounded-xl border bg-gradient-to-br p-4 ${borderClass} ${isEliminated ? "bg-slate-900/60" : "bg-slate-800/70"} backdrop-blur-sm`}
    >
      {/* Rank badge */}
      {rank && !isEliminated && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
          className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-slate-600 shadow"
        >
          {RANK_LABELS[rank] ?? `#${rank}`}
        </motion.div>
      )}

      {/* Eliminated X overlay */}
      {isEliminated && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-full h-0.5 bg-red-500/50 rotate-12 absolute" />
          <div className="w-full h-0.5 bg-red-500/50 -rotate-12 absolute" />
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className={`font-semibold text-sm leading-tight truncate ${isEliminated ? "text-slate-500 line-through" : "text-white"}`}>
            {supplier.supplier_name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{supplier.supplier_id}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {supplier.preferred_supplier && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-ciq-600/20 text-sky-300 border border-ciq-600/20 font-medium">
              Preferred
            </span>
          )}
          {supplier.is_restricted && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
              Restricted
            </span>
          )}
        </div>
      </div>

      {/* Score bars (quality / risk / esg) */}
      {!isEliminated && (
        <div className="space-y-1.5 mb-3">
          <ScoreBar label="Quality" value={supplier.quality_score} color="bg-emerald-500" />
          <ScoreBar label="ESG"     value={supplier.esg_score}     color="bg-teal-500" />
          <ScoreBar label="Risk"    value={supplier.risk_score}    color="bg-orange-500" invert />
        </div>
      )}

      {/* Pricing if ranked */}
      {ranked && ranked.unit_price !== null && !isEliminated && (
        <div className="text-xs text-slate-400 mb-2">
          <span className="text-slate-300 font-medium">{ranked.total_price !== null ? formatCurrency(ranked.total_price, supplier.currency) : "—"}</span>
          {" "}total · {formatCurrency(ranked.unit_price, supplier.currency)}/unit
        </div>
      )}

      {/* Composite score */}
      {ranked && !isEliminated && (
        <div className="text-[10px] text-slate-500">
          Score: <span className="text-sky-400 font-mono font-semibold">{ranked.score.toFixed(1)}</span>
        </div>
      )}

      {/* Elimination reason */}
      {eliminated && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-2 p-2 rounded-lg bg-red-950/60 border border-red-900/50"
        >
          <p className="text-[10px] text-red-400 leading-snug">{eliminated.reason}</p>
          {eliminated.ruleId && (
            <span className="inline-block mt-1 text-[9px] font-mono bg-red-900/40 text-red-500 px-1.5 py-0.5 rounded">
              {eliminated.ruleId}
            </span>
          )}
        </motion.div>
      )}

      {/* Warning flags */}
      {flags.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 * i }}
          className={`mt-1.5 flex items-start gap-1 p-1.5 rounded ${f.severity === "warn" ? "bg-amber-950/40 border border-amber-800/40" : "bg-ciq-600/20 border border-ciq-600/20"}`}
        >
          <span className="text-xs">{f.severity === "warn" ? "⚠" : "ℹ"}</span>
          <p className={`text-[10px] leading-snug ${f.severity === "warn" ? "text-amber-400" : "text-blue-400"}`}>{f.flag}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function ScoreBar({ label, value, color, invert = false }: { label: string; value: number; color: string; invert?: boolean }) {
  const display = invert ? 100 - value : value;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${display}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] text-slate-500 w-6 text-right">{value}</span>
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
