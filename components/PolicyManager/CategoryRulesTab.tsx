"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, PolicyTable, SectionHeader,
  inputCls, selectCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/category-rules";

interface CategoryRule {
  rule_id:     string;
  category_l1: string;
  category_l2: string;
  rule_type:   string;
  rule_text:   string;
}

const BLANK: Omit<CategoryRule, "rule_id"> = {
  category_l1: "IT", category_l2: "", rule_type: "", rule_text: "",
};

const L1_OPTIONS = ["IT", "Facilities", "HR", "Marketing", "Professional Services"];
const RULE_TYPES = [
  "mandatory_comparison", "fast_track", "security_review", "residency_check",
  "engineering_spec_review", "design_signoff", "cv_review", "certification_check",
  "performance_baseline", "brand_safety", "other",
];

const COLS: ColDef<CategoryRule>[] = [
  { key: "rule_id",     header: "ID",       className: "font-mono text-sky-400 w-20" },
  { key: "category_l1", header: "L1",       className: "w-28" },
  { key: "category_l2", header: "Sub-category" },
  { key: "rule_type",   header: "Type",     render: (r) => <span className="font-mono text-[10px] text-emerald-400">{r.rule_type}</span> },
  { key: "rule_text",   header: "Rule",     render: (r) => <span className="text-slate-400 line-clamp-2">{r.rule_text}</span> },
];

export default function CategoryRulesTab() {
  const { rows, loading, error, refresh } = usePolicyData<CategoryRule>(ENDPOINT);
  const [form,     setForm]   = useState<Omit<CategoryRule, "rule_id"> | null>(null);
  const [editId,   setEditId] = useState<string | null>(null);
  const [saving,   setSaving] = useState(false);
  const [saveErr,  setSaveErr] = useState<string | null>(null);

  const openAdd  = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: CategoryRule) => { setForm({ category_l1: r.category_l1, category_l2: r.category_l2, rule_type: r.rule_type, rule_text: r.rule_text }); setEditId(r.rule_id); setSaveErr(null); };
  const close    = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const result = await savePolicy(ENDPOINT, editId, form);
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
      <SectionHeader title="Category Rules" count={rows.length} onAdd={openAdd} addLabel="New Rule" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit ${editId}` : "New Category Rule"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Category L1" required>
              <select value={form.category_l1} onChange={(e) => setForm({ ...form, category_l1: e.target.value })} className={selectCls}>
                {L1_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Sub-category (L2)" required>
              <input value={form.category_l2} onChange={(e) => setForm({ ...form, category_l2: e.target.value })} placeholder="e.g. Laptops" className={inputCls} />
            </FormField>
            <FormField label="Rule Type" required>
              <select value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })} className={selectCls}>
                <option value="">Select type…</option>
                {RULE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Rule Text" required>
              <textarea value={form.rule_text} onChange={(e) => setForm({ ...form, rule_text: e.target.value })} rows={3} placeholder="Policy rule description…" className={`${inputCls} resize-none sm:col-span-2`} />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.rule_id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
