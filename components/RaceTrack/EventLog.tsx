"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PipelineEvent } from "@/src/pipeline/types";

interface Props {
  events: PipelineEvent[];
}

const EVENT_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  REQUEST_PARSED:      { dot: "bg-sky-400",     text: "text-sky-300",     label: "Parsed" },
  CANDIDATE_POOL:      { dot: "bg-violet-400",  text: "text-violet-300",  label: "Pool" },
  SUPPLIER_ELIMINATED: { dot: "bg-red-500",     text: "text-red-300",     label: "Eliminated" },
  SUPPLIER_FLAGGED:    { dot: "bg-amber-400",   text: "text-amber-300",   label: "Flagged" },
  POLICY_APPLIED:      { dot: "bg-emerald-400", text: "text-emerald-300", label: "Policy" },
  VALIDATION_ISSUE:    { dot: "bg-orange-500",  text: "text-orange-300",  label: "Validation" },
  SHORTLIST:           { dot: "bg-teal-400",    text: "text-teal-300",    label: "Shortlist" },
  ESCALATION:          { dot: "bg-red-400",     text: "text-red-300",     label: "Escalation" },
  RECOMMENDATION:      { dot: "bg-yellow-400",  text: "text-yellow-300",  label: "Decision" },
  COMPLETE:            { dot: "bg-green-400",   text: "text-green-300",   label: "Complete" },
  ERROR:               { dot: "bg-red-600",     text: "text-red-400",     label: "Error" },
};

function eventSummary(event: PipelineEvent): string {
  switch (event.type) {
    case "REQUEST_PARSED":
      return `Request parsed: ${event.data.interpretation.category_l2} / ${event.data.interpretation.country}`;
    case "CANDIDATE_POOL":
      return `${event.data.count} candidate supplier(s) identified for ${event.data.suppliers[0]?.category_l2 ?? "category"}`;
    case "SUPPLIER_ELIMINATED":
      return `${event.data.name} eliminated — ${event.data.reason}`;
    case "SUPPLIER_FLAGGED":
      return `${event.data.name} flagged — ${event.data.flag}`;
    case "POLICY_APPLIED":
      return `[${event.data.ruleId}] ${event.data.description}`;
    case "VALIDATION_ISSUE":
      return `[${event.data.severity.toUpperCase()}] ${event.data.type}: ${event.data.description}`;
    case "SHORTLIST":
      return `Shortlist finalised: ${event.data.suppliers.length} supplier(s) ranked. Requires ${event.data.quotesRequired} quote(s) — ${event.data.approver}`;
    case "ESCALATION":
      return `${event.data.rule} → ${event.data.escalate_to}${event.data.blocking ? " [BLOCKING]" : ""}`;
    case "RECOMMENDATION":
      return `Decision: ${event.data.status.replace(/_/g, " ")} — ${event.data.reason.slice(0, 80)}…`;
    case "COMPLETE":
      return "Pipeline complete";
    case "ERROR":
      return `Error: ${event.data.message}`;
    default:
      return (event as { type: string }).type;
  }
}

export default function EventLog({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
        Event Log <span className="text-slate-600 font-normal">({events.length})</span>
      </p>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        <AnimatePresence initial={false}>
          {events.map((ev, i) => {
            const style = EVENT_STYLES[ev.type] ?? { dot: "bg-slate-500", text: "text-slate-400", label: ev.type };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 py-1"
              >
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <div className="min-w-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide mr-1.5 ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-slate-400 leading-snug break-words">
                    {eventSummary(ev)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
