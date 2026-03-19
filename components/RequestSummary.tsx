"use client";

import { motion } from "framer-motion";
import type { RequestInput } from "@/src/pipeline/types";

interface Props {
  request:   RequestInput;
  isRunning: boolean;
  onNew:     () => void;
}

export default function RequestSummary({ request, isRunning, onNew }: Props) {
  const fields: Array<{ label: string; value: string | null }> = [
    { label: "Category",  value: request.category_l1 || null },
    { label: "Type",      value: request.category_l2 || null },
    { label: "Budget",    value: request.budget_amount != null ? `${request.currency ?? ""} ${Number(request.budget_amount).toLocaleString()}` : null },
    { label: "Quantity",  value: request.quantity != null ? `${request.quantity} ${request.unit_of_measure ?? "units"}` : null },
    { label: "Deadline",  value: request.required_by_date || null },
    { label: "Delivery",  value: request.delivery_countries?.join(", ") || null },
    { label: "Preferred", value: request.preferred_supplier_mentioned || null },
    { label: "Country",   value: request.country || null },
  ].filter((f) => f.value);

  return (
    <div className="space-y-4">

      {/* Request text */}
      {request.request_text && (
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-[10px] font-semibold mb-1.5" style={{ color: "var(--ciq-red)" }}>REQUEST</p>
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-5">{request.request_text}</p>
        </div>
      )}

      {/* Fields */}
      {fields.length > 0 && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-[10px] font-semibold text-slate-500">EXTRACTED FIELDS</p>
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-2">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-ciq-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-slate-500 leading-none">{f.label}</p>
                <p className="text-xs text-slate-200 font-medium truncate">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status indicator */}
      {isRunning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--surface-2)" }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: "var(--ciq-red)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--ciq-red)" }}>Pipeline running…</span>
        </motion.div>
      )}

      {/* New request button */}
      <button
        onClick={onNew}
        disabled={isRunning}
        className="w-full py-2 rounded-xl text-xs font-semibold border transition-all text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--border)", background: "transparent" }}
        type="button"
      >
        + New Request
      </button>
    </div>
  );
}
