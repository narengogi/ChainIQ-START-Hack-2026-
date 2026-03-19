"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandingChat      from "@/components/LandingChat";
import RequestSummary   from "@/components/RequestSummary";
import RaceTrack        from "@/components/RaceTrack";
import EventLog         from "@/components/RaceTrack/EventLog";
import FinalOutput      from "@/components/FinalOutput";
import PolicyManager    from "@/components/PolicyManager";
import type { FinalRecommendation, PipelineEvent, RequestInput } from "@/src/pipeline/types";

type AppPhase = "landing" | "pipeline";
type AppView  = "pipeline" | "policies";

export default function HomePage() {
  const [appPhase,  setAppPhase]  = useState<AppPhase>("landing");
  const [appView,   setAppView]   = useState<AppView>("pipeline");

  const [activeRequest,     setActiveRequest]     = useState<RequestInput | null>(null);
  const [events,            setEvents]            = useState<PipelineEvent[]>([]);
  const [isRunning,         setIsRunning]         = useState(false);
  const [recommendation,    setRecommendation]    = useState<FinalRecommendation | null>(null);
  const [error,             setError]             = useState<string | null>(null);

  const handleSubmit = useCallback(async (request: RequestInput) => {
    setActiveRequest(request);
    setAppPhase("pipeline");
    setAppView("pipeline");
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
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as PipelineEvent;
            setEvents((prev) => [...prev, event]);
            if (event.type === "RECOMMENDATION") setRecommendation(event.data);
            if (event.type === "COMPLETE" || event.type === "ERROR") {
              if (event.type === "ERROR") setError(event.data.message);
              setIsRunning(false);
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  }, []);

  function handleNewRequest() {
    setAppPhase("landing");
    setEvents([]);
    setRecommendation(null);
    setError(null);
    setActiveRequest(null);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header
        className="border-b px-6 py-0 flex items-center justify-between shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-6">

          {/* ChainIQ wordmark */}
          <button
            onClick={handleNewRequest}
            className="flex items-center gap-0 py-3.5 cursor-pointer"
            type="button"
          >
            <span
              className="text-base font-black leading-none"
              style={{ color: "var(--ciq-red)", fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.02em" }}
            >Chain</span>
            <span
              className="text-base font-black leading-none text-white"
              style={{ fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.02em" }}
            >IQ</span>
            <span
              className="ml-3 text-[9px] font-semibold uppercase"
              style={{ color: "var(--text-muted)", letterSpacing: "0.14em" }}
            >Smart Sourcing</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5" style={{ background: "var(--border)" }} />

          {/* View switcher — only shown in pipeline phase */}
          <AnimatePresence>
            {appPhase === "pipeline" && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex gap-0.5 p-0.5 rounded-lg border"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                {([
                  { id: "pipeline" as AppView, label: "Pipeline", icon: "⚡" },
                  { id: "policies" as AppView, label: "Policies",  icon: "📋" },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setAppView(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                      appView === v.id ? "text-white shadow" : "text-slate-400 hover:text-slate-200"
                    }`}
                    style={appView === v.id ? { background: "var(--ciq-red)" } : {}}
                  >
                    <span>{v.icon}</span>
                    {v.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Running indicator */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs font-medium"
              style={{ color: "var(--ciq-red)" }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ciq-red)" }} />
              Pipeline running
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── Landing phase ───────────────────────────────────── */}
          {appPhase === "landing" && (
            <motion.div
              key="landing"
              className="flex-1 flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3 }}
            >
              <LandingChat onSubmit={handleSubmit} />
            </motion.div>
          )}

          {/* ── Pipeline phase ──────────────────────────────────── */}
          {appPhase === "pipeline" && (
            <motion.div
              key="pipeline"
              className="flex-1 flex overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {/* Policies view */}
              {appView === "policies" && <PolicyManager />}

              {/* Pipeline view */}
              {appView === "pipeline" && (
                <>
                  {/* Left sidebar — request summary */}
                  <motion.aside
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-80 shrink-0 border-r overflow-y-auto p-5"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {activeRequest && (
                      <RequestSummary
                        request={activeRequest}
                        isRunning={isRunning}
                        onNew={handleNewRequest}
                      />
                    )}
                  </motion.aside>

                  {/* Main — race track */}
                  <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="flex-1 flex overflow-hidden">

                      {/* Race + output */}
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

                        <RaceTrack events={events} />

                        {/* Final output */}
                        <AnimatePresence>
                          {recommendation && (
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-base">🏆</span>
                                <h3 className="text-sm font-bold text-yellow-400" style={{ fontFamily: "Montserrat, Inter, system-ui" }}>
                                  Final Recommendation
                                </h3>
                                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                              </div>
                              <FinalOutput recommendation={recommendation} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Event log — right */}
                      <aside
                        className="w-72 shrink-0 border-l p-4 overflow-hidden flex flex-col"
                        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      >
                        <EventLog events={events} />
                      </aside>
                    </div>
                  </main>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
