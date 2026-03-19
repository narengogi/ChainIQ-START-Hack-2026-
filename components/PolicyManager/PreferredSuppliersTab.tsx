"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, TagInput, PolicyTable, SectionHeader,
  inputCls, selectCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/preferred-suppliers";

interface PreferredSupplier {
  id:           number;
  supplier_id:  string;
  supplier_name:string;
  category_l1:  string;
  category_l2:  string;
  region_scope: string | string[] | null;
  policy_note:  string | null;
}

type FormState = {
  supplier_id: string; supplier_name: string;
  category_l1: string; category_l2: string;
  region_scope: string[]; policy_note: string;
};

const BLANK: FormState = {
  supplier_id: "", supplier_name: "", category_l1: "IT", category_l2: "",
  region_scope: [], policy_note: "",
};

const L1_OPTIONS = ["IT", "Facilities", "HR", "Marketing", "Professional Services"];

function parseArr(v: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

const COLS: ColDef<PreferredSupplier>[] = [
  { key: "supplier_id",   header: "Supplier ID", className: "font-mono text-sky-400 w-24" },
  { key: "supplier_name", header: "Name" },
  { key: "category_l1",  header: "L1",          className: "w-28" },
  { key: "category_l2",  header: "Sub-category" },
  {
    key: "region_scope",
    header: "Regions",
    render: (r) => {
      const arr = parseArr(r.region_scope);
      return arr.length
        ? <span className="flex flex-wrap gap-1">{arr.map((t) => <span key={t} className="text-[10px] font-mono bg-emerald-900/30 border border-emerald-800/30 text-emerald-300 px-1 rounded">{t}</span>)}</span>
        : <span className="text-slate-600">Global</span>;
    },
  },
  { key: "policy_note", header: "Note", render: (r) => <span className="text-slate-400 line-clamp-1">{r.policy_note ?? "—"}</span> },
];

export default function PreferredSuppliersTab() {
  const { rows, loading, error, refresh } = usePolicyData<PreferredSupplier>(ENDPOINT);
  const [form,    setForm]    = useState<FormState | null>(null);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: PreferredSupplier) => {
    setForm({
      supplier_id:   r.supplier_id,
      supplier_name: r.supplier_name,
      category_l1:   r.category_l1,
      category_l2:   r.category_l2,
      region_scope:  parseArr(r.region_scope),
      policy_note:   r.policy_note ?? "",
    });
    setEditId(r.id);
    setSaveErr(null);
  };
  const close = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const result = await savePolicy(ENDPOINT, editId, {
      ...form,
      region_scope: form.region_scope.length ? form.region_scope : undefined,
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
      <SectionHeader title="Preferred Suppliers" count={rows.length} onAdd={openAdd} addLabel="Add Preferred" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit Preferred #${editId}` : "Add Preferred Supplier"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Supplier ID" required>
              <input value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} placeholder="e.g. SUP-0001" className={inputCls} />
            </FormField>
            <FormField label="Supplier Name" required>
              <input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Dell Enterprise Europe" className={inputCls} />
            </FormField>
            <FormField label="Category L1" required>
              <select value={form.category_l1} onChange={(e) => setForm({ ...form, category_l1: e.target.value })} className={selectCls}>
                {L1_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Sub-category (L2)" required>
              <input value={form.category_l2} onChange={(e) => setForm({ ...form, category_l2: e.target.value })} placeholder="e.g. Laptops" className={inputCls} />
            </FormField>
            <FormField label="Region Scope (blank = global)">
              <TagInput value={form.region_scope} onChange={(v) => setForm({ ...form, region_scope: v })} placeholder="EU, CH, APAC…" />
            </FormField>
            <FormField label="Policy Note">
              <textarea value={form.policy_note} onChange={(e) => setForm({ ...form, policy_note: e.target.value })} rows={2} placeholder="Optional note…" className={`${inputCls} resize-none`} />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
