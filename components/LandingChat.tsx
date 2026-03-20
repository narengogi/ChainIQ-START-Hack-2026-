"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RequestInput } from "@/src/pipeline/types";
import type { MissingField, ParseResult } from "@/src/lib/requestHelpers";

interface Props {
  onSubmit: (request: RequestInput) => void;
}

type Phase = "input" | "parsing" | "chatting";

interface ChatMsg {
  role:    "ai" | "user";
  text:    string;
  typing?: boolean; // AI "thinking" bubble
}

interface QAPair {
  question: string;
  answer:   string;
}

const SUGGESTIONS = [
  "400 consulting days of IT project management support starting next month, budget EUR 400,000, delivery Germany",
  "50 laptops for our Paris office by end of March, budget EUR 40,000. Prefer Dell or Lenovo.",
  "Cloud compute capacity for a new analytics platform, 12-month contract, budget CHF 180,000, delivery CH",
  "240 docking stations for Berlin team by 20 March 2026, budget EUR 25,200",
];

// Build the augmented text that is sent to the LLM after each chat answer.
// Appending the QA pairs as natural language lets the model resolve things like
// "Berlin" → DE, "end of next month" → a proper ISO date, etc.
function buildAugmentedText(originalText: string, qaPairs: QAPair[]): string {
  if (!qaPairs.length) return originalText;
  const clarifications = qaPairs
    .map((qa) => `- When asked "${qa.question}", the user replied: "${qa.answer}"`)
    .join("\n");
  return `${originalText}\n\nAdditional clarifications provided by the requester:\n${clarifications}`;
}

function buildRequest(parseResult: ParseResult): RequestInput {
  const p = parseResult.parsed;
  return {
    request_channel:           "portal",
    request_language:          "en",
    business_unit:             (p.business_unit as string) || "General",
    country:                   (p.country       as string) || "DE",
    category_l1:               (p.category_l1   as string) || "",
    category_l2:               (p.category_l2   as string) || "",
    title:                     "Smart Request",
    request_text:              (p.request_text  as string) || "",
    currency:                  (p.currency      as RequestInput["currency"]) || "EUR",
    budget_amount:             typeof p.budget_amount === "number" ? p.budget_amount : null,
    quantity:                  typeof p.quantity      === "number" ? p.quantity      : null,
    unit_of_measure:           (p.unit_of_measure as string) || undefined,
    required_by_date:          (p.required_by_date as string) || undefined,
    delivery_countries:        Array.isArray(p.delivery_countries) ? p.delivery_countries : [],
    preferred_supplier_mentioned: (p.preferred_supplier_mentioned as string) || undefined,
    incumbent_supplier:        (p.incumbent_supplier as string) || undefined,
    contract_type_requested:   (p.contract_type_requested as string) || undefined,
    data_residency_constraint: Boolean(p.data_residency_constraint),
    esg_requirement:           Boolean(p.esg_requirement),
  };
}

export default function LandingChat({ onSubmit }: Props) {
  const [phase,            setPhase]            = useState<Phase>("input");
  const [text,             setText]             = useState("");
  const [parseResult,      setParseResult]      = useState<ParseResult | null>(null);
  const [parseError,       setParseError]       = useState<string | null>(null);

  // Chat state
  const [chatMsgs,         setChatMsgs]         = useState<ChatMsg[]>([]);
  const [chatInput,        setChatInput]        = useState("");
  const [isThinking,       setIsThinking]       = useState(false);
  const [qaPairs,          setQaPairs]          = useState<QAPair[]>([]);

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, isThinking]);
  useEffect(() => { if (phase === "chatting") chatInputRef.current?.focus(); }, [phase, isThinking]);

  // ── Parse via API ──────────────────────────────────────────────────────────

  async function callParseAPI(payload: string): Promise<ParseResult | null> {
    const res  = await fetch("/api/parse-request", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: payload }),
    });
    const data = await res.json() as ParseResult & { error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? "Parsing failed");
    return data;
  }

  // ── Initial analyze ────────────────────────────────────────────────────────

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPhase("parsing");
    setParseError(null);

    try {
      const data = await callParseAPI(trimmed);
      if (!data) return;
      setParseResult(data);

      const reqMissing = data.missing.filter((f: MissingField) => f.required);

      if (reqMissing.length === 0) {
        // All good — launch immediately
        onSubmit(buildRequest(data));
        return;
      }

      // Enter chat to collect missing required fields
      setChatMsgs([
        { role: "user", text: trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed },
        { role: "ai",   text: formatSummary(data) },
        { role: "ai",   text: reqMissing[0].question },
      ]);
      setQaPairs([]);
      setPhase("chatting");

    } catch (e) {
      setParseError(String(e));
      setPhase("input");
    }
  }

  // ── Handle each chat reply ─────────────────────────────────────────────────
  // After every user answer we rebuild the augmented text and re-parse with the
  // LLM, so answers like "Berlin", "next month", "half a million" are resolved
  // intelligently rather than with naive string splitting.

  async function handleChatSend() {
    const value = chatInput.trim();
    if (!value || !parseResult || isThinking) return;

    const currentMissing = parseResult.missing.filter((f: MissingField) => f.required);
    if (!currentMissing.length) return;

    const currentField = currentMissing[0];
    const newQA        = [...qaPairs, { question: currentField.question, answer: value }];

    // Show user message + AI thinking bubble immediately
    setChatMsgs(prev => [
      ...prev,
      { role: "user", text: value },
    ]);
    setChatInput("");
    setIsThinking(true);
    setQaPairs(newQA);

    try {
      const augmented = buildAugmentedText(text, newQA);
      const data      = await callParseAPI(augmented);
      if (!data) return;

      setParseResult(data);
      const stillMissing = data.missing.filter((f: MissingField) => f.required);

      if (stillMissing.length === 0) {
        setChatMsgs(prev => [
          ...prev,
          { role: "ai", text: "All details confirmed. Launching the procurement pipeline…" },
        ]);
        setTimeout(() => onSubmit(buildRequest(data)), 800);
      } else {
        setChatMsgs(prev => [
          ...prev,
          { role: "ai", text: stillMissing[0].question },
        ]);
      }

    } catch {
      setChatMsgs(prev => [
        ...prev,
        { role: "ai", text: "Sorry, I had trouble understanding that. Could you rephrase?" },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleParse(); }
  }

  // Count how many required fields are still outstanding
  const remainingCount = parseResult
    ? parseResult.missing.filter((f: MissingField) => f.required).length
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">

      {/* Wordmark */}
      <AnimatePresence>
        {phase !== "chatting" && (
          <motion.div
            key="wordmark"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col items-center gap-2 mb-10"
          >
            <div className="flex items-baseline">
              <span className="text-5xl font-black leading-none" style={{ color: "var(--ciq-red)", fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.03em" }}>Chain</span>
              <span className="text-5xl font-black leading-none text-white" style={{ fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.03em" }}>IQ</span>
            </div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-widest" style={{ letterSpacing: "0.18em" }}>Smart Sourcing</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── Input phase ─────────────────────────────────────────────────── */}
        {phase !== "chatting" && (
          <motion.div
            key="input-phase"
            className="w-full max-w-2xl space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
          >
            <div className="relative rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => { setText(e.target.value); setParseError(null); }}
                onKeyDown={handleInputKeyDown}
                rows={4}
                placeholder="Describe your procurement need in plain language…"
                disabled={phase === "parsing"}
                className="w-full bg-transparent px-5 pt-4 pb-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
              />
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <span className="text-[10px] text-slate-600">⌘ Enter to smart source</span>
                <button
                  onClick={handleParse}
                  disabled={!text.trim() || phase === "parsing"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: "var(--ciq-red)" }}
                  type="button"
                >
                  {phase === "parsing" ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing…
                    </>
                  ) : "✨ smart source"}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {parseError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3 text-xs text-red-400">
                  {parseError}
                </motion.div>
              )}
            </AnimatePresence>

            {!parseError && (
              <motion.div className="flex flex-wrap gap-2 justify-center pt-1">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    onClick={() => { setText(s); setParseError(null); }}
                    className="text-[11px] px-3 py-1.5 rounded-full border text-slate-400 hover:text-slate-200 transition-colors"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    type="button"
                  >
                    {s.length > 62 ? s.slice(0, 60) + "…" : s}
                  </motion.button>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.4 } }}
              className="flex flex-wrap gap-2 justify-center mt-6"
            >
              {["Professional Services", "IT Hardware", "Cloud Infrastructure", "Facilities", "Marketing"].map(cap => (
                <span key={cap} className="text-[10px] px-2.5 py-1 rounded-full text-slate-500 border" style={{ borderColor: "var(--border)" }}>
                  {cap}
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ── Chat phase ──────────────────────────────────────────────────── */}
        {phase === "chatting" && (
          <motion.div
            key="chat-phase"
            className="w-full max-w-2xl flex flex-col"
            style={{ height: "72vh" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--ciq-red)" }}>
                <span className="text-white text-[9px] font-bold">IQ</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white" style={{ fontFamily: "Montserrat, Inter, system-ui" }}>ChainIQ</p>
                <p className="text-[10px] text-slate-500">Just a few more details needed</p>
              </div>
              {remainingCount > 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  {Array.from({ length: remainingCount }).map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--ciq-red)", opacity: 0.4 + (i === 0 ? 0.6 : 0) }} />
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMsgs.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i === chatMsgs.length - 1 ? 0.05 : 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "ai" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5" style={{ background: "var(--ciq-red)" }}>
                      <span className="text-white text-[8px] font-bold">IQ</span>
                    </div>
                  )}
                  <div
                    className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user" ? "text-white rounded-tr-sm" : "text-slate-200 rounded-tl-sm"
                    }`}
                    style={
                      msg.role === "user"
                        ? { background: "var(--ciq-red)" }
                        : { background: "var(--surface-2)", border: "1px solid var(--border)" }
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {/* Thinking indicator */}
              <AnimatePresence>
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5" style={{ background: "var(--ciq-red)" }}>
                      <span className="text-white text-[8px] font-bold">IQ</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-slate-500"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="mt-4 pt-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={isThinking ? "Interpreting your answer…" : "Type your answer…"}
                  disabled={isThinking}
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-ciq-600 bg-transparent disabled:opacity-40"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || isThinking}
                  className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                  style={{ background: "var(--ciq-red)" }}
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-2 text-center">
                Answer naturally — ChainIQ will interpret your response
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSummary(result: ParseResult): string {
  const p     = result.parsed;
  const parts: string[] = [];
  if (p.category_l2)      parts.push(p.category_l2 as string);
  else if (p.category_l1) parts.push(p.category_l1 as string);
  if (p.quantity && p.unit_of_measure) parts.push(`${p.quantity} ${p.unit_of_measure}`);
  else if (p.quantity)    parts.push(`qty ${p.quantity}`);
  if (p.budget_amount)    parts.push(`budget ${p.currency ?? "EUR"} ${(p.budget_amount as number).toLocaleString()}`);
  if (p.required_by_date) parts.push(`by ${p.required_by_date}`);
  const base = result.summary ?? (parts.length ? `Got it — ${parts.join(", ")}.` : "Got your request.");
  return `${base} I just need a few more details before we kick off the pipeline.`;
}
