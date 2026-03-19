"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RequestInput } from "@/src/pipeline/types";
import type { MissingField, ParseResult } from "@/src/lib/requestHelpers";
import { mergeAnswers } from "@/src/lib/requestHelpers";

interface Props {
  onSubmit:  (request: RequestInput) => void;
  isRunning: boolean;
}

const EXAMPLE_TEXT =
  "We need 240 docking stations for our Berlin Digital Workplace team to match the existing laptop fleet. " +
  "They must arrive by 20 March 2026. Our budget is EUR 25,200. " +
  "We have been using Dell Enterprise Europe but open to alternatives. Please do not use restricted vendors.";

export default function TextRequestInput({ onSubmit, isRunning }: Props) {
  const [text,        setText]        = useState("");
  const [isParsing,   setIsParsing]   = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [answers,     setAnswers]     = useState<Record<string, string>>({});

  const merged = useMemo<Partial<RequestInput> | null>(() => {
    if (!parseResult) return null;
    return mergeAnswers(parseResult.parsed, answers);
  }, [parseResult, answers]);

  const requiredMissing: MissingField[] = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.missing.filter((f) => {
      if (!f.required) return false;
      const answer = answers[f.field];
      if (answer && answer.trim()) return false;
      return true;
    });
  }, [parseResult, answers]);

  const canSubmit = parseResult !== null && requiredMissing.length === 0 && !isRunning;

  async function handleParse() {
    if (!text.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setParseResult(null);
    setAnswers({});

    try {
      const res = await fetch("/api/parse-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
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

  const displayFields: Array<{ key: string; label: string; value: string | null }> = parseResult
    ? [
        { key: "category_l1",    label: "Category L1",    value: parseResult.parsed.category_l1 ?? null },
        { key: "category_l2",    label: "Sub-category",   value: parseResult.parsed.category_l2 ?? null },
        { key: "budget_amount",  label: "Budget",         value: parseResult.parsed.budget_amount != null ? `${parseResult.parsed.currency ?? ""} ${parseResult.parsed.budget_amount.toLocaleString()}` : null },
        { key: "quantity",       label: "Quantity",       value: parseResult.parsed.quantity != null ? `${parseResult.parsed.quantity} ${parseResult.parsed.unit_of_measure ?? "units"}` : null },
        { key: "delivery_countries", label: "Delivery",  value: parseResult.parsed.delivery_countries?.join(", ") || null },
        { key: "required_by_date",   label: "Deadline",  value: parseResult.parsed.required_by_date ?? null },
        { key: "preferred_supplier_mentioned", label: "Preferred", value: parseResult.parsed.preferred_supplier_mentioned ?? null },
      ]
    : [];

  return (
    <div className="space-y-4">

      {/* Input area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">Describe your procurement need</label>
          <button
            onClick={() => setText(EXAMPLE_TEXT)}
            className="text-[10px] text-ciq-400 hover:text-ciq-400 transition-colors"
            type="button"
          >
            Load example
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setParseResult(null); setParseError(null); }}
          rows={7}
          placeholder="e.g. We need 50 laptops for our Paris office by end of month, budget EUR 40,000. Prefer Dell or Lenovo."
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ciq-600 resize-none leading-relaxed"
        />
      </div>

      <button
        onClick={handleParse}
        disabled={!text.trim() || isParsing || isRunning}
        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        style={{ background: "var(--ciq-red)" }}
        type="button"
      >
        {isParsing ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing request…
          </>
        ) : (
          <>
            <span>✨</span>
            Procure
          </>
        )}
      </button>

      {/* Parse error */}
      <AnimatePresence>
        {parseError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-2.5 text-xs text-red-400"
          >
            {parseError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parse results */}
      <AnimatePresence>
        {parseResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Summary card */}
            <div className="rounded-xl border border-ciq-600/20 bg-ciq-600/20 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold text-ciq-400">AI INTERPRETATION</span>
                <ConfidenceBadge value={parseResult.confidence} />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{parseResult.summary}</p>
            </div>

            {/* Extracted fields */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-emerald-400 mb-2">Extracted fields</p>
              {displayFields.map((f) => (
                <div key={f.key} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.value ? "bg-emerald-500" : "bg-slate-700"}`} />
                  <span className="text-slate-500 w-24 shrink-0">{f.label}</span>
                  <span className={f.value ? "text-slate-200 font-mono text-[11px]" : "text-slate-600 italic"}>
                    {f.value ?? "not found"}
                  </span>
                </div>
              ))}
            </div>

            {/* Missing fields — require user input */}
            {parseResult.missing.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-yellow-400 flex items-center gap-1.5">
                  <span>⚠</span>
                  {parseResult.missing.filter(f => f.required).length > 0
                    ? `${parseResult.missing.filter(f => f.required).length} required field${parseResult.missing.filter(f => f.required).length !== 1 ? "s" : ""} missing`
                    : "Optional fields missing"}
                </p>
                {parseResult.missing.map((f) => (
                  <MissingFieldInput
                    key={f.field}
                    field={f}
                    value={answers[f.field] ?? ""}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [f.field]: v }))}
                  />
                ))}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                canSubmit ? "text-white" : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
              style={canSubmit ? { background: "var(--ciq-red)" } : {}}
              type="button"
            >
              {isRunning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Pipeline running…
                </>
              ) : canSubmit ? (
                "Run Procurement Pipeline →"
              ) : (
                `Fill ${requiredMissing.length} required field${requiredMissing.length !== 1 ? "s" : ""} above`
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
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
  field,
  value,
  onChange,
}: {
  field:    MissingField;
  value:    string;
  onChange: (v: string) => void;
}) {
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
        {isFilled
          ? <span className="text-emerald-500 text-[10px]">✓</span>
          : <span className={`text-[10px] ${field.required ? "text-yellow-500" : "text-slate-500"}`}>{field.required ? "●" : "○"}</span>
        }
        <span className="text-[10px] font-semibold text-slate-400">{field.label}</span>
        {field.required && !isFilled && (
          <span className="text-[9px] text-yellow-600 font-mono">REQUIRED</span>
        )}
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">{field.question}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer…"
        className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
    </motion.div>
  );
}
