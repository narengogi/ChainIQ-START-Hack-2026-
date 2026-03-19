"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Data fetching hook ──────────────────────────────────────────────────────

export function usePolicyData<T>(endpoint: string) {
  const [rows,    setRows]    = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(endpoint);
      const data = await res.json() as T[] | { error: string };
      if (Array.isArray(data)) {
        setRows(data);
      } else {
        setError(data.error ?? "Failed to load");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { rows, loading, error, refresh };
}

// ─── Save (POST / PUT) ────────────────────────────────────────────────────────

export async function savePolicy(
  endpoint: string,
  id: string | number | null,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const url    = id != null ? `${endpoint}/${id}` : endpoint;
  const method = id != null ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok?: boolean; error?: string };
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Save failed" };
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deletePolicy(
  endpoint: string,
  id: string | number,
): Promise<{ ok: boolean; error?: string }> {
  const res  = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
  const data = await res.json() as { ok?: boolean; error?: string };
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Delete failed" };
}

// ─── TagInput ────────────────────────────────────────────────────────────────

export function TagInput({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2 py-0.5 bg-ciq-600/20 border border-ciq-600/20 rounded-full text-[11px] text-ciq-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-ciq-500 hover:text-red-400 leading-none"
            >×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }}}
          placeholder={placeholder ?? "Type and press Enter…"}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ciq-600"
        />
        <button
          type="button"
          onClick={add}
          className="px-2.5 py-1.5 rounded-lg bg-ciq-600/20 text-ciq-300 text-xs hover:bg-ciq-600/20"
        >Add</button>
      </div>
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

export function FormField({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-ciq-600";
export const selectCls = `${inputCls} cursor-pointer`;

// ─── FormPanel ────────────────────────────────────────────────────────────────

export function FormPanel({
  title, onClose, onSave, saving, error, children,
}: {
  title:    string;
  onClose:  () => void;
  onSave:   () => void;
  saving:   boolean;
  error:    string | null;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-ciq-600/20 bg-slate-900/80 backdrop-blur p-4 space-y-4 mb-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ciq-300">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-lg leading-none"
        >×</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600">
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-ciq-600 hover:bg-ciq-600 text-white disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── PolicyTable ──────────────────────────────────────────────────────────────

export interface ColDef<T> {
  key:       string;
  header:    string;
  render?:   (row: T) => React.ReactNode;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PolicyTable<T extends Record<string, any>>({
  cols, rows, loading, error, getId, onEdit, onDelete,
}: {
  cols:     ColDef<T>[];
  rows:     T[];
  loading:  boolean;
  error:    string | null;
  getId:    (row: T) => string | number;
  onEdit:   (row: T) => void;
  onDelete: (id: string | number) => void;
}) {
  const [confirming, setConfirming] = useState<string | number | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center h-24 text-xs text-slate-500">
      <span className="w-4 h-4 border-2 border-slate-600 border-t-sky-500 rounded-full animate-spin mr-2" />
      Loading…
    </div>
  );

  if (error) return (
    <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-3 py-2">{error}</div>
  );

  if (rows.length === 0) return (
    <div className="flex items-center justify-center h-20 text-xs text-slate-600 border border-dashed border-slate-800 rounded-xl">
      No records yet
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/60">
            {cols.map((c) => (
              <th key={c.key} className={`px-3 py-2.5 text-left font-semibold text-slate-400 whitespace-nowrap ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-slate-400 w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row) => {
            const id = getId(row);
            return (
              <tr key={id} className="hover:bg-slate-800/20 transition-colors">
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 text-slate-300 ${c.className ?? ""}`}>
                    {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {confirming === id ? (
                    <span className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { onDelete(id); setConfirming(null); }}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
                      >Confirm</button>
                      <span className="text-slate-600">/</span>
                      <button
                        onClick={() => setConfirming(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >Cancel</button>
                    </span>
                  ) : (
                    <span className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(row)}
                        className="text-[10px] text-ciq-500 hover:text-ciq-300 font-medium"
                      >Edit</button>
                      <button
                        onClick={() => setConfirming(id)}
                        className="text-[10px] text-red-600 hover:text-red-400 font-medium"
                      >Delete</button>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab header ──────────────────────────────────────────────────────────────

export function TabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string; icon: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-800 mb-5 overflow-x-auto pb-px">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
            active === t.id
              ? "border-ciq-600 text-ciq-300"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <span>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

export function SectionHeader({
  title, count, onAdd, addLabel = "New",
}: { title: string; count: number; onAdd: () => void; addLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">{count} record{count !== 1 ? "s" : ""}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ciq-600 hover:bg-ciq-600 text-white text-xs font-semibold transition-colors"
      >
        <span className="text-base leading-none">+</span>
        {addLabel}
      </button>
    </div>
  );
}

export { AnimatePresence };
