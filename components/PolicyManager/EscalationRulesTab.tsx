"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  usePolicyData, savePolicy, deletePolicy,
  FormPanel, FormField, TagInput, PolicyTable, SectionHeader,
  inputCls,
  type ColDef,
} from "./shared";

const ENDPOINT = "/api/policies/escalation-rules";

interface EscalationRule {
  rule_id:               string;
  trigger_condition:     string;
  action:                string;
  escalate_to:           string;
  applies_to_currencies: string | string[] | null;
}

type FormState = {
  trigger_condition: string;
  action: string;
  escalate_to: string;
  applies_to_currencies: string[];
};

const BLANK: FormState = {
  trigger_condition: "", action: "escalate", escalate_to: "", applies_to_currencies: [],
};

function parseArr(v: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

const COLS: ColDef<EscalationRule>[] = [
  { key: "rule_id",           header: "ID",      className: "font-mono text-sky-400 w-20" },
  { key: "trigger_condition", header: "Trigger", render: (r) => <span className="font-mono text-[10px] text-orange-400">{r.trigger_condition}</span> },
  { key: "action",            header: "Action",  className: "w-20 text-slate-400" },
  { key: "escalate_to",       header: "Escalate To" },
  {
    key: "applies_to_currencies",
    header: "Currencies",
    render: (r) => {
      const arr = parseArr(r.applies_to_currencies);
      return arr.length ? <span className="font-mono text-[10px] text-violet-300">{arr.join(", ")}</span> : <span className="text-slate-600">All</span>;
    },
  },
];

export default function EscalationRulesTab() {
  const { rows, loading, error, refresh } = usePolicyData<EscalationRule>(ENDPOINT);
  const [form,    setForm]    = useState<FormState | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const openAdd = () => { setForm({ ...BLANK }); setEditId(null); setSaveErr(null); };
  const openEdit = (r: EscalationRule) => {
    setForm({
      trigger_condition:     r.trigger_condition,
      action:                r.action,
      escalate_to:           r.escalate_to,
      applies_to_currencies: parseArr(r.applies_to_currencies),
    });
    setEditId(r.rule_id);
    setSaveErr(null);
  };
  const close = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSaveErr(null);
    const result = await savePolicy(ENDPOINT, editId, {
      trigger_condition:     form.trigger_condition,
      action:                form.action,
      escalate_to:           form.escalate_to,
      applies_to_currencies: form.applies_to_currencies.length ? form.applies_to_currencies : undefined,
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
      <SectionHeader title="Escalation Rules" count={rows.length} onAdd={openAdd} addLabel="New Rule" />

      <AnimatePresence>
        {form && (
          <FormPanel title={editId ? `Edit ${editId}` : "New Escalation Rule"} onClose={close} onSave={handleSave} saving={saving} error={saveErr}>
            <FormField label="Trigger Condition" required>
              <input value={form.trigger_condition} onChange={(e) => setForm({ ...form, trigger_condition: e.target.value })} placeholder="e.g. no_compliant_supplier_found" className={inputCls} />
            </FormField>
            <FormField label="Action">
              <input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="escalate" className={inputCls} />
            </FormField>
            <FormField label="Escalate To" required>
              <input value={form.escalate_to} onChange={(e) => setForm({ ...form, escalate_to: e.target.value })} placeholder="e.g. Head of Category" className={inputCls} />
            </FormField>
            <FormField label="Applies To Currencies (blank = all)">
              <TagInput value={form.applies_to_currencies} onChange={(v) => setForm({ ...form, applies_to_currencies: v })} placeholder="EUR, CHF, USD" />
            </FormField>
          </FormPanel>
        )}
      </AnimatePresence>

      <PolicyTable cols={COLS} rows={rows} loading={loading} error={error} getId={(r) => r.rule_id} onEdit={openEdit} onDelete={handleDelete} />
    </div>
  );
}
