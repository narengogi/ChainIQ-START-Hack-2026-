"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RequestInput } from "@/src/pipeline/types";
import type { MissingField, ParseResult } from "@/src/lib/requestHelpers";
import { mergeAnswers } from "@/src/lib/requestHelpers";

interface Props {
  onSubmit: (request: RequestInput) => void;
}

const SUGGESTIONS = [
  "400 consulting days of IT project management support starting next month, budget EUR 400,000",
  "50 laptops for our Paris office by end of March, budget EUR 40,000. Prefer Dell or Lenovo.",
  "Cloud compute capacity for a new analytics platform, 12-month contract, budget CHF 180,000",
  "240 docking stations for Berlin team by 20 March 2026, budget EUR 25,200",
];

export default function LandingChat({ onSubmit }: Props) {
  const [text,        setText]        = useState("");
  const [isParsing,   setIsParsing]   = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [answers,     setAnswers]     = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const merged = useMemo<Partial<RequestInput> | null>(() => {
    if (!parseResult) return null;
    return mergeAnswers(parseResult.parsed, answers);
  }, [parseResult, answers]);

  const requiredMissing: MissingField[] = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.missing.filter((f) => {
      if (!f.required) return false;
      const answer = answers[f.field];
      return !answer?.trim();
    });
  }, [parseResult, answers]);

  const canSubmit = parseResult !== null && requiredMissing.length === 0;

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsParsing(true);
    setParseError(null);
    setParseResult(null);
    setAnswers({});

    try {
      const res  = await fetch("/api/parse-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: trimmed }),
      });
      const data = await res.json() as ParseResult & { error?: string };
      if (!res.ok || data.error) {
        setParseError(data.error ?? "Parsing failed");
      } else {
        setParseResult(data);
      }
    } catch (e) {
      setParseError(String(e));
    } finally {
      setIsParsing(false);
    }
  }

  function handleSubmit() {
    if (!merged || !canSubmit) return;

    const request: RequestInput = {
      request_channel:           "portal",
      request_language:          "en",
      business_unit:             "General",
      country:                   "DE",
      category_l1:               "",
      category_l2:               "",
      title:                     "Text Request",
      request_text:              text,
      currency:                  "EUR",
      budget_amount:             null,
      quantity:                  null,
      delivery_countries:        [],
      data_residency_constraint: false,
      esg_requirement:           false,
      ...merged,
    } as RequestInput;

    onSubmit(request);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!parseResult) handleParse();
      else if (canSubmit) handleSubmit();
    }
  }

  const displayFields: Array<{ key: string; label: string; value: string | null }> = parseResult
    ? [
        { key: "category_l1",               label: "Category",   value: parseResult.parsed.category_l1 ?? null },
        { key: "category_l2",               label: "Type",        value: parseResult.parsed.category_l2 ?? null },
        { key: "budget_amount",             label: "Budget",      value: parseResult.parsed.budget_amount != null ? `${parseResult.parsed.currency ?? "EUR"} ${parseResult.parsed.budget_amount.toLocaleString()}` : null },
        { key: "quantity",                  label: "Quantity",    value: parseResult.parsed.quantity != null ? `${parseResult.parsed.quantity} ${parseResult.parsed.unit_of_measure ?? "units"}` : null },
        { key: "required_by_date",          label: "Deadline",    value: parseResult.parsed.required_by_date ?? null },
        { key: "delivery_countries",        label: "Delivery",    value: parseResult.parsed.delivery_countries?.join(", ") || null },
        { key: "preferred_supplier_mentioned", label: "Preferred", value: parseResult.parsed.preferred_supplier_mentioned ?? null },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 overflow-y-auto">

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-2 mb-10"
      >
        <div className="flex items-baseline gap-0">
          <span
            className="text-5xl font-black leading-none tracking-tight"
            style={{ color: "var(--ciq-red)", fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.03em" }}
          >
            Chain
          </span>
          <span
            className="text-5xl font-black leading-none tracking-tight text-white"
            style={{ fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.03em" }}
          >
            IQ
          </span>
        </div>
        <p className="text-sm text-slate-500 tracking-widest uppercase font-medium" style={{ letterSpacing: "0.18em" }}>
          Smart Sourcing
        </p>
      </motion.div>

      {/* Main input card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="w-full max-w-2xl space-y-3"
      >
        {/* Textarea */}
        <div className="relative rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); setParseResult(null); setParseError(null); setAnswers({}); }}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="Describe your procurement need in plain language…"
            className="w-full bg-transparent px-5 pt-4 pb-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed"
          />

          {/* Bottom bar inside the input card */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <span className="text-[10px] text-slate-600">⌘ Enter to analyze</span>
            <button
              onClick={handleParse}
              disabled={!text.trim() || isParsing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: "var(--ciq-red)" }}
              type="button"
            >
              {isParsing ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>✨ smart source</>
              )}
            </button>
          </div>
        </div>

        {/* Suggestion chips */}
        <AnimatePresence>
          {!parseResult && !isParsing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 justify-center pt-1"
            >
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  onClick={() => { setText(s); setParseResult(null); }}
                  className="text-[11px] px-3 py-1.5 rounded-full border text-slate-400 hover:text-slate-200 transition-colors"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  type="button"
                >
                  {s.length > 60 ? s.slice(0, 58) + "…" : s}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parse error */}
        <AnimatePresence>
          {parseError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3 text-xs text-red-400"
            >
              {parseError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parse result panel */}
        <AnimatePresence>
          {parseResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {/* AI summary */}
              <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-bold" style={{ color: "var(--ciq-red)" }}>AI INTERPRETATION</span>
                  <ConfidenceBadge value={parseResult.confidence} />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{parseResult.summary}</p>
              </div>

              {/* Fields grid */}
              <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
                {displayFields.map((f) => (
                  <div key={f.key} className="flex items-start gap-2">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${f.value ? "bg-emerald-500" : "bg-slate-700"}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 leading-none mb-0.5">{f.label}</p>
                      <p className={`text-xs truncate ${f.value ? "text-slate-200 font-medium" : "text-slate-600 italic"}`}>
                        {f.value ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Missing fields */}
              {parseResult.missing.length > 0 && (
                <div className="px-5 pb-4 space-y-2">
                  <p className="text-[10px] font-semibold text-yellow-400 flex items-center gap-1.5">
                    <span>⚠</span>
                    {parseResult.missing.filter(f => f.required).length > 0
                      ? `${parseResult.missing.filter(f => f.required).length} required field${parseResult.missing.filter(f => f.required).length !== 1 ? "s" : ""} needed`
                      : "Optional fields missing — you can proceed"}
                  </p>
                  <div className="grid gap-2">
                    {parseResult.missing.map((f) => (
                      <MissingFieldInput
                        key={f.field}
                        field={f}
                        value={answers[f.field] ?? ""}
                        onChange={(v) => setAnswers((prev) => ({ ...prev, [f.field]: v }))}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Run button */}
              <div className="px-5 pb-5">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    canSubmit ? "text-white" : "text-slate-500 cursor-not-allowed"
                  }`}
                  style={canSubmit ? { background: "var(--ciq-red)" } : { background: "var(--surface-2)" }}
                  type="button"
                >
                  {canSubmit ? (
                    <>
                      Run Procurement Pipeline
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  ) : (
                    `Fill ${requiredMissing.length} required field${requiredMissing.length !== 1 ? "s" : ""} above`
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Capability pills at bottom */}
      <AnimatePresence>
        {!parseResult && !isParsing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.4 } }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap gap-2 justify-center mt-8 max-w-lg"
          >
            {["Professional Services", "IT Hardware", "Cloud Infrastructure", "Facilities", "Marketing"].map((cap) => (
              <span
                key={cap}
                className="text-[10px] px-2.5 py-1 rounded-full text-slate-500 border"
                style={{ borderColor: "var(--border)" }}
              >
                {cap}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/40"
              : pct >= 60 ? "text-yellow-400 bg-yellow-950/40 border-yellow-800/40"
              :             "text-red-400 bg-red-950/40 border-red-800/40";
  return (
    <span className={`text-[9px] font-mono font-semibold border rounded px-1 py-0.5 ${color}`}>
      {pct}% confident
    </span>
  );
}

function MissingFieldInput({
  field, value, onChange,
}: { field: MissingField; value: string; onChange: (v: string) => void }) {
  const isFilled = value.trim().length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
        isFilled
          ? "border-emerald-800/40 bg-emerald-950/10"
          : field.required
            ? "border-yellow-800/40 bg-yellow-950/10"
            : "border-slate-800 bg-slate-900/20"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] ${isFilled ? "text-emerald-500" : field.required ? "text-yellow-500" : "text-slate-500"}`}>
          {isFilled ? "✓" : field.required ? "●" : "○"}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
        {field.required && !isFilled && (
          <span className="text-[9px] text-yellow-600 font-mono ml-auto">REQUIRED</span>
        )}
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">{field.question}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer…"
        className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ciq-600"
      />
    </motion.div>
  );
}
