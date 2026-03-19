"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RequestForm from "@/components/RequestForm";
import TextRequestInput from "@/components/TextRequestInput";
import RaceTrack from "@/components/RaceTrack";
import EventLog from "@/components/RaceTrack/EventLog";
import FinalOutput from "@/components/FinalOutput";
import PolicyManager from "@/components/PolicyManager";
import type { FinalRecommendation, PipelineEvent, RequestInput } from "@/src/pipeline/types";

type InputMode = "form" | "text";
type AppView   = "pipeline" | "policies";

export default function HomePage() {
  const [appView, setAppView] = useState<AppView>("pipeline");
  const [events, setEvents]           = useState<PipelineEvent[]>([]);
  const [isRunning, setIsRunning]     = useState(false);
  const [recommendation, setRecommendation] = useState<FinalRecommendation | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [inputMode, setInputMode]     = useState<InputMode>("form");

  const handleSubmit = useCallback(async (request: RequestInput) => {
    // Reset state
    setEvents([]);
    setRecommendation(null);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/pipeline", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(request),
      });

      if (!response.ok || !response.body) {
        setError(`Pipeline request failed: ${response.status}`);
        setIsRunning(false);
        return;
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? ""; // keep incomplete last chunk

        for (const chunk of lines) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as PipelineEvent;
            setEvents((prev) => [...prev, event]);

            if (event.type === "RECOMMENDATION") {
              setRecommendation(event.data);
            }
            if (event.type === "COMPLETE" || event.type === "ERROR") {
              if (event.type === "ERROR") setError(event.data.message);
              setIsRunning(false);
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  }, []);

  const hasActivity = events.length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>

      {/* Top bar */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <span className="text-sky-400 text-sm font-bold">⛓</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-none">ChainIQ</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Procurement Intelligence</p>
            </div>
          </div>

          {/* View switcher */}
          <div className="flex gap-0.5 p-0.5 bg-slate-800/80 rounded-lg border border-slate-700/50">
            {([
              { id: "pipeline" as AppView, label: "Pipeline", icon: "⚡" },
              { id: "policies" as AppView, label: "Policies",  icon: "📋" },
            ] as const).map((v) => (
              <button
                key={v.id}
                onClick={() => setAppView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                  appView === v.id
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{v.icon}</span>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {isRunning && appView === "pipeline" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-sky-400"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Pipeline running
          </motion.div>
        )}
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Policies view */}
        {appView === "policies" && <PolicyManager />}

        {/* Pipeline view */}
        {appView === "pipeline" && <>

        {/* Left panel — Form or Text */}
        <aside className="w-96 shrink-0 border-r border-slate-800 overflow-y-auto p-5" style={{ background: "var(--surface)" }}>
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl mb-5">
            {(["form", "text"] as InputMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  inputMode === mode
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                type="button"
              >
                {mode === "form" ? "📋 Form" : "✨ Chat"}
              </button>
            ))}
          </div>

          {inputMode === "form" ? (
            <RequestForm onSubmit={handleSubmit} isRunning={isRunning} />
          ) : (
            <TextRequestInput onSubmit={handleSubmit} isRunning={isRunning} />
          )}
        </aside>

        {/* Right panel — Race + Output */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {!hasActivity ? (
            <EmptyState />
          ) : (
            <div className="flex-1 flex overflow-hidden">

              {/* Race track — main area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Error banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-sm text-red-300"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Race visualization */}
                <RaceTrack events={events} />

                {/* Final output */}
                <AnimatePresence>
                  {recommendation && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">🏆</span>
                        <h3 className="text-sm font-semibold text-yellow-400">Final Recommendation</h3>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                      <FinalOutput recommendation={recommendation} />
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Event log — right sidebar */}
              <aside className="w-72 shrink-0 border-l border-slate-800 p-4 overflow-hidden flex flex-col" style={{ background: "var(--surface)" }}>
                <EventLog events={events} />
              </aside>

            </div>
          )}
        </main>

        </> /* end pipeline view */}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="text-5xl"
      >
        🏁
      </motion.div>
      <div>
        <h2 className="text-lg font-semibold text-slate-300">Ready to race</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-xs">
          Fill in the request form on the left and hit <span className="text-sky-400">Run Procurement Pipeline</span> to watch suppliers compete in real time.
        </p>
      </div>
      <div className="flex flex-col gap-2 mt-2 text-xs text-slate-600 max-w-xs">
        {["Suppliers filtered by region, restrictions & capacity", "Policies applied with live event stream", "Shortlist ranked by price, quality, risk & ESG", "Escalations triggered automatically"].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-2"
          >
            <span className="text-sky-500">→</span>
            {item}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
