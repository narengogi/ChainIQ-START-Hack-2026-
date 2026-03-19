"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, TagInput, PolicyTable, SectionHeader,
  inputCls, selectCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/restricted-suppliers";

interface RestrictedSupplier {
  id:                 number;
  supplier_id:        string;
  supplier_name:      string;
  category_l1:        string;
  category_l2:        string;
  restriction_scope:  string | string[];
  restriction_reason: string;
}

type FormState = {
  supplier_id: string; supplier_name: string;
  category_l1: string; category_l2: string;
  restriction_scope: string[]; restriction_reason: string;
  global_restriction: boolean;
};

const BLANK: FormState = {
  supplier_id: "", supplier_name: "", category_l1: "IT", category_l2: "",
  restriction_scope: [], restriction_reason: "", global_restriction: false,
};

const L1_OPTIONS = ["IT", "Facilities", "HR", "Marketing", "Professional Services"];

function parseArr(v: string | string[]): string[] {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

const COLS: ColDef<RestrictedSupplier>[] = [
  { key: "supplier_id",   header: "Supplier ID", className: "font-mono text-red-400 w-24" },
  { key: "supplier_name", header: "Name" },
  { key: "category_l1",  header: "L1",          className: "w-28" },
  { key: "category_l2",  header: "Sub-category" },
  {
    key: "restriction_scope",
    header: "Scope",
    render: (r) => {
      const arr = parseArr(r.restriction_scope);
      const isGlobal = arr.includes("all");
      return isGlobal
        ? <span className="text-[10px] font-semibold text-red-400 bg-red-950/40 border border-red-800/30 px-1.5 rounded">GLOBAL</span>
        : <span className="flex flex-wrap gap-1">{arr.map((t) => <span key={t} className="text-[10px] font-mono bg-orange-900/30 border border-orange-800/30 text-orange-300 px-1 rounded">{t}</span>)}</span>;
    },
  },
  { key: "restriction_reason", header: "Reason", render: (r) => <span className="text-slate-400 line-clamp-2">{r.restriction_reason}</span> },
];

export default function RestrictedSuppliersTab() {
  const { rows, loading, error, refresh } = usePolicyData<RestrictedSupplier>(ENDPOINT);
  const [form,    setForm]    = useState<FormState | null>(null);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: RestrictedSupplier) => {
    const arr = parseArr(r.restriction_scope);
    const isGlobal = arr.includes("all");
    setForm({
      supplier_id:         r.supplier_id,
      supplier_name:       r.supplier_name,
      category_l1:         r.category_l1,
      category_l2:         r.category_l2,
      restriction_scope:   isGlobal ? [] : arr,
      restriction_reason:  r.restriction_reason,
      global_restriction:  isGlobal,
    });
    setEditId(r.id);
    setSaveErr(null);
  };
  const close = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const restriction_scope = form.global_restriction ? ["all"] : form.restriction_scope;
    const result = await savePolicy(ENDPOINT, editId, {
      supplier_id:        form.supplier_id,
      supplier_name:      form.supplier_name,
      category_l1:        form.category_l1,
      category_l2:        form.category_l2,
      restriction_scope,
      restriction_reason: form.restriction_reason,
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
      <SectionHeader title="Restricted Suppliers" count={rows.length} onAdd={openAdd} addLabel="Add Restriction" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit Restriction #${editId}` : "Add Restricted Supplier"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Supplier ID" required>
              <input value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} placeholder="e.g. SUP-0008" className={inputCls} />
            </FormField>
            <FormField label="Supplier Name" required>
              <input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier name" className={inputCls} />
            </FormField>
            <FormField label="Category L1" required>
              <select value={form.category_l1} onChange={(e) => setForm({ ...form, category_l1: e.target.value })} className={selectCls}>
                {L1_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Sub-category (L2)" required>
              <input value={form.category_l2} onChange={(e) => setForm({ ...form, category_l2: e.target.value })} placeholder="e.g. Laptops" className={inputCls} />
            </FormField>
            <FormField label="Restriction Scope">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.global_restriction}
                    onChange={(e) => setForm({ ...form, global_restriction: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800"
                  />
                  <span className="text-xs text-red-400 font-semibold">Global restriction (all countries)</span>
                </label>
                {!form.global_restriction && (
                  <TagInput value={form.restriction_scope} onChange={(v) => setForm({ ...form, restriction_scope: v })} placeholder="DE, CH, US…" />
                )}
              </div>
            </FormField>
            <FormField label="Restriction Reason" required>
              <textarea value={form.restriction_reason} onChange={(e) => setForm({ ...form, restriction_reason: e.target.value })} rows={2} placeholder="Why is this supplier restricted?" className={`${inputCls} resize-none`} />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
