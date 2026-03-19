"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, TagInput, PolicyTable, SectionHeader,
  inputCls, selectCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/geography-rules";

interface GeographyRule {
  rule_id:    string;
  country:    string | null;
  region:     string | null;
  countries:  string | string[] | null;
  rule_type:  string | null;
  rule_text:  string;
  applies_to: string | string[] | null;
}

type FormState = {
  scope_type:  "country" | "region";
  country:     string;
  region:      string;
  countries:   string[];
  rule_type:   string;
  rule_text:   string;
  applies_to:  string[];
};

const BLANK: FormState = {
  scope_type: "country", country: "", region: "", countries: [],
  rule_type: "", rule_text: "", applies_to: [],
};

const REGIONS = ["EU", "Americas", "APAC", "MEA", "LATAM"];
const L1_OPTIONS = ["IT", "Facilities", "HR", "Marketing", "Professional Services"];

function parseArr(v: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

const COLS: ColDef<GeographyRule>[] = [
  { key: "rule_id",   header: "ID",     className: "font-mono text-sky-400 w-20" },
  {
    key: "scope",
    header: "Scope",
    render: (r) => (
      r.country
        ? <span className="font-mono text-xs bg-sky-900/40 border border-sky-800/30 text-sky-300 px-1.5 rounded">{r.country}</span>
        : r.region
          ? <span className="font-mono text-xs bg-violet-900/40 border border-violet-800/30 text-violet-300 px-1.5 rounded">{r.region}</span>
          : <span className="text-slate-500 text-[10px]">{parseArr(r.countries).join(", ")}</span>
    ),
  },
  { key: "rule_type", header: "Type",   render: (r) => <span className="text-[10px] font-mono text-emerald-400">{r.rule_type ?? "—"}</span> },
  { key: "rule_text", header: "Rule",   render: (r) => <span className="text-slate-400 line-clamp-2">{r.rule_text}</span> },
  {
    key: "applies_to",
    header: "Applies To",
    render: (r) => {
      const arr = parseArr(r.applies_to);
      return arr.length ? <span className="text-[10px] text-slate-400">{arr.join(", ")}</span> : <span className="text-slate-600">All</span>;
    },
  },
];

export default function GeographyRulesTab() {
  const { rows, loading, error, refresh } = usePolicyData<GeographyRule>(ENDPOINT);
  const [form,    setForm]    = useState<FormState | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: GeographyRule) => {
    setForm({
      scope_type: r.country ? "country" : "region",
      country:    r.country ?? "",
      region:     r.region ?? "",
      countries:  parseArr(r.countries),
      rule_type:  r.rule_type ?? "",
      rule_text:  r.rule_text,
      applies_to: parseArr(r.applies_to),
    });
    setEditId(r.rule_id);
    setSaveErr(null);
  };
  const close = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const body = form.scope_type === "country"
      ? { country: form.country || undefined, rule_type: form.rule_type || undefined, rule_text: form.rule_text, applies_to: form.applies_to.length ? form.applies_to : undefined }
      : { region: form.region || undefined, countries: form.countries.length ? form.countries : undefined, rule_text: form.rule_text, applies_to: form.applies_to.length ? form.applies_to : undefined };
    const result = await savePolicy(ENDPOINT, editId, body);
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
      <SectionHeader title="Geography Rules" count={rows.length} onAdd={openAdd} addLabel="New Rule" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit ${editId}` : "New Geography Rule"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Scope Type" required>
              <select value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value as "country" | "region" })} className={selectCls}>
                <option value="country">Single Country</option>
                <option value="region">Region / Multi-Country</option>
              </select>
            </FormField>

            {form.scope_type === "country" ? (
              <>
                <FormField label="Country Code" required>
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} placeholder="e.g. DE" maxLength={2} className={inputCls} />
                </FormField>
                <FormField label="Rule Type">
                  <input value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })} placeholder="e.g. sovereign_preference" className={inputCls} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Region">
                  <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={selectCls}>
                    <option value="">Select…</option>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="Countries in Region">
                  <TagInput value={form.countries} onChange={(v) => setForm({ ...form, countries: v })} placeholder="US, CA, BR…" />
                </FormField>
              </>
            )}

            <FormField label="Rule Text" required>
              <textarea value={form.rule_text} onChange={(e) => setForm({ ...form, rule_text: e.target.value })} rows={3} className={`${inputCls} resize-none sm:col-span-2`} />
            </FormField>
            <FormField label="Applies To Categories (blank = all)">
              <TagInput value={form.applies_to} onChange={(v) => setForm({ ...form, applies_to: v })} placeholder={L1_OPTIONS.join(", ")} />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.rule_id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
