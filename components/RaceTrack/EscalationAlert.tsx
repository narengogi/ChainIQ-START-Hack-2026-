"use client";

import { motion } from "framer-motion";
import type { Escalation } from "@/src/pipeline/types";

interface Props {
  escalations: Escalation[];
}

export default function EscalationAlert({ escalations }: Props) {
  if (escalations.length === 0) return null;

  return (
    <div className="space-y-2">
      {escalations.map((esc, i) => (
        <motion.div
          key={esc.escalation_id}
          initial={{ opacity: 0, y: -12, scaleY: 0.8 }}
          animate={{ opacity: 1, y: 0,  scaleY: 1 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
          className={`rounded-xl border p-3 ${
            esc.blocking
              ? "bg-red-950/50 border-red-800/60"
              : "bg-amber-950/40 border-amber-800/50"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${esc.blocking ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
              {esc.blocking ? "!" : "↑"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-mono font-semibold ${esc.blocking ? "text-red-400" : "text-amber-400"}`}>
                  {esc.rule}
                </span>
                {esc.blocking && (
                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    Blocking
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">{esc.trigger}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Escalate to: <span className={`font-medium ${esc.blocking ? "text-red-400" : "text-amber-400"}`}>{esc.escalate_to}</span>
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
