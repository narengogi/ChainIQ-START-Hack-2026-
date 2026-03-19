"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, TagInput, PolicyTable, SectionHeader,
  inputCls, selectCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/approval-thresholds";

interface ApprovalThreshold {
  threshold_id:                     string;
  currency:                         string;
  min_amount:                       string;
  max_amount:                       string | null;
  min_supplier_quotes:              number;
  managed_by:                       string | string[];
  deviation_approval_required_from: string | string[];
  policy_note:                      string | null;
}

type FormState = {
  currency: string; min_amount: string; max_amount: string;
  min_supplier_quotes: string;
  managed_by: string[];
  deviation_approval_required_from: string[];
  policy_note: string;
};

const BLANK: FormState = {
  currency: "EUR", min_amount: "0", max_amount: "",
  min_supplier_quotes: "1", managed_by: ["business"],
  deviation_approval_required_from: [], policy_note: "",
};

function parseArr(v: string | string[]): string[] {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

const fmt = (n: string | number | null) =>
  n != null ? Number(n).toLocaleString() : "∞";

const COLS: ColDef<ApprovalThreshold>[] = [
  { key: "threshold_id", header: "ID",       className: "font-mono text-sky-400 w-20" },
  { key: "currency",     header: "Currency", className: "w-16" },
  { key: "min_amount",   header: "Min",      render: (r) => <span className="font-mono">{fmt(r.min_amount)}</span> },
  { key: "max_amount",   header: "Max",      render: (r) => <span className="font-mono">{fmt(r.max_amount)}</span> },
  { key: "min_supplier_quotes", header: "Min Quotes", className: "w-24 text-center" },
  { key: "managed_by",   header: "Managed By", render: (r) => <Tags items={parseArr(r.managed_by)} color="sky" /> },
  { key: "deviation_approval_required_from", header: "Approver", render: (r) => <Tags items={parseArr(r.deviation_approval_required_from)} color="violet" /> },
];

function Tags({ items, color }: { items: string[]; color: "sky" | "violet" }) {
  const cls = color === "sky"
    ? "bg-ciq-600/20 text-sky-300 border-ciq-600/20"
    : "bg-violet-900/40 text-violet-300 border-violet-800/30";
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((t) => <span key={t} className={`text-[10px] font-mono border rounded px-1 ${cls}`}>{t}</span>)}
    </span>
  );
}

export default function ApprovalThresholdsTab() {
  const { rows, loading, error, refresh } = usePolicyData<ApprovalThreshold>(ENDPOINT);
  const [form,    setForm]    = useState<FormState | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: ApprovalThreshold) => {
    setForm({
      currency: r.currency,
      min_amount: String(r.min_amount),
      max_amount: r.max_amount != null ? String(r.max_amount) : "",
      min_supplier_quotes: String(r.min_supplier_quotes),
      managed_by: parseArr(r.managed_by),
      deviation_approval_required_from: parseArr(r.deviation_approval_required_from),
      policy_note: r.policy_note ?? "",
    });
    setEditId(r.threshold_id);
    setSaveErr(null);
  };
  const close = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const result = await savePolicy(ENDPOINT, editId, {
      currency: form.currency,
      min_amount: parseFloat(form.min_amount),
      max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
      min_supplier_quotes: parseInt(form.min_supplier_quotes),
      managed_by: form.managed_by,
      deviation_approval_required_from: form.deviation_approval_required_from,
      policy_note: form.policy_note || null,
    });
    setSaving(false);
    if (result.ok) { close(); void refresh(); }
    else setSaveErr(result.error ?? "Save failed");
  };

  const handleDelete = async (id: string | number) => {
    await deletePolicy(ENDPOINT, id);
    void refresh();
  };

  return (
    <div>
      <SectionHeader title="Approval Thresholds" count={rows.length} onAdd={openAdd} addLabel="New Threshold" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit ${editId}` : "New Approval Threshold"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Currency" required>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={selectCls}>
                {["EUR", "CHF", "USD"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Min Amount" required>
              <input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className={inputCls} />
            </FormField>
            <FormField label="Max Amount (leave blank for unlimited)">
              <input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="Unlimited" className={inputCls} />
            </FormField>
            <FormField label="Min Supplier Quotes" required>
              <input type="number" min={1} value={form.min_supplier_quotes} onChange={(e) => setForm({ ...form, min_supplier_quotes: e.target.value })} className={inputCls} />
            </FormField>
            <FormField label="Managed By (roles)">
              <TagInput value={form.managed_by} onChange={(v) => setForm({ ...form, managed_by: v })} placeholder="e.g. business, procurement" />
            </FormField>
            <FormField label="Deviation Approval Required From">
              <TagInput value={form.deviation_approval_required_from} onChange={(v) => setForm({ ...form, deviation_approval_required_from: v })} placeholder="e.g. Procurement Manager" />
            </FormField>
            <FormField label="Policy Note">
              <textarea value={form.policy_note} onChange={(e) => setForm({ ...form, policy_note: e.target.value })} rows={2} placeholder="Optional note…" className={`${inputCls} resize-none sm:col-span-2`} />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.threshold_id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
