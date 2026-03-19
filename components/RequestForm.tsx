"use client";

import { useEffect, useMemo, useState } from "react";
import type { RequestInput } from "@/src/pipeline/types";

const EXAMPLE: RequestInput = {
  request_id:                   "REQ-000004",
  created_at:                   "2026-03-14T17:55:00Z",
  request_channel:              "teams",
  request_language:             "en",
  business_unit:                "Digital Workplace",
  country:                      "DE",
  site:                         "Berlin",
  requester_id:                 "USR-3004",
  requester_role:               "Workplace Lead",
  submitted_for_id:             "USR-8004",
  category_l1:                  "IT",
  category_l2:                  "Docking Stations",
  title:                        "Docking station purchase",
  request_text:                 "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.",
  currency:                     "EUR",
  budget_amount:                25199.55,
  quantity:                     240,
  unit_of_measure:              "device",
  required_by_date:             "2026-03-20",
  preferred_supplier_mentioned: "Dell Enterprise Europe",
  incumbent_supplier:           "Bechtle Workplace Solutions",
  contract_type_requested:      "purchase",
  delivery_countries:           ["DE"],
  data_residency_constraint:    false,
  esg_requirement:              false,
  status:                       "pending_review",
  scenario_tags:                ["contradictory"],
};

const ALL_COUNTRIES = [
  { code: "DE", label: "Germany",        group: "EU" },
  { code: "FR", label: "France",         group: "EU" },
  { code: "NL", label: "Netherlands",    group: "EU" },
  { code: "BE", label: "Belgium",        group: "EU" },
  { code: "AT", label: "Austria",        group: "EU" },
  { code: "IT", label: "Italy",          group: "EU" },
  { code: "ES", label: "Spain",          group: "EU" },
  { code: "PL", label: "Poland",         group: "EU" },
  { code: "UK", label: "United Kingdom", group: "EU" },
  { code: "CH", label: "Switzerland",    group: "CH" },
  { code: "US", label: "United States",  group: "Americas" },
  { code: "CA", label: "Canada",         group: "Americas" },
  { code: "BR", label: "Brazil",         group: "Americas" },
  { code: "MX", label: "Mexico",         group: "Americas" },
  { code: "SG", label: "Singapore",      group: "APAC" },
  { code: "AU", label: "Australia",      group: "APAC" },
  { code: "IN", label: "India",          group: "APAC" },
  { code: "JP", label: "Japan",          group: "APAC" },
  { code: "UAE", label: "UAE",           group: "MEA" },
  { code: "ZA", label: "South Africa",   group: "MEA" },
];

interface CategoryRow { category_l1: string; category_l2: string; typical_unit: string | null }

// Static fallback — matches categories.csv so the form works without a DB connection
const STATIC_CATEGORIES: CategoryRow[] = [
  { category_l1: "IT", category_l2: "Laptops",                            typical_unit: "device" },
  { category_l1: "IT", category_l2: "Mobile Workstations",                typical_unit: "device" },
  { category_l1: "IT", category_l2: "Desktop Workstations",               typical_unit: "device" },
  { category_l1: "IT", category_l2: "Monitors",                           typical_unit: "device" },
  { category_l1: "IT", category_l2: "Docking Stations",                   typical_unit: "device" },
  { category_l1: "IT", category_l2: "Smartphones",                        typical_unit: "device" },
  { category_l1: "IT", category_l2: "Tablets",                            typical_unit: "device" },
  { category_l1: "IT", category_l2: "Rugged Devices",                     typical_unit: "device" },
  { category_l1: "IT", category_l2: "Accessories Bundles",                typical_unit: "set" },
  { category_l1: "IT", category_l2: "Replacement / Break-Fix Pool Devices", typical_unit: "device" },
  { category_l1: "IT", category_l2: "Cloud Compute",                      typical_unit: "instance_hour" },
  { category_l1: "IT", category_l2: "Cloud Storage",                      typical_unit: "TB_month" },
  { category_l1: "IT", category_l2: "Cloud Networking",                   typical_unit: "GB_transfer" },
  { category_l1: "IT", category_l2: "Managed Cloud Platform Services",    typical_unit: "monthly_subscription" },
  { category_l1: "IT", category_l2: "Cloud Security Services",            typical_unit: "seat_license" },
  { category_l1: "Facilities", category_l2: "Workstations and Desks",     typical_unit: "unit" },
  { category_l1: "Facilities", category_l2: "Office Chairs",              typical_unit: "unit" },
  { category_l1: "Facilities", category_l2: "Meeting Room Furniture",     typical_unit: "set" },
  { category_l1: "Facilities", category_l2: "Storage Cabinets",           typical_unit: "unit" },
  { category_l1: "Facilities", category_l2: "Reception and Lounge Furniture", typical_unit: null },
  { category_l1: "Professional Services", category_l2: "Cloud Architecture Consulting",  typical_unit: "consulting_day" },
  { category_l1: "Professional Services", category_l2: "Cybersecurity Advisory",         typical_unit: "consulting_day" },
  { category_l1: "Professional Services", category_l2: "Data Engineering Services",      typical_unit: "consulting_day" },
  { category_l1: "Professional Services", category_l2: "Software Development Services",  typical_unit: "consulting_day" },
  { category_l1: "Professional Services", category_l2: "IT Project Management Services", typical_unit: "consulting_day" },
  { category_l1: "Marketing", category_l2: "Search Engine Marketing (SEM)",        typical_unit: "campaign" },
  { category_l1: "Marketing", category_l2: "Social Media Advertising",             typical_unit: "campaign" },
  { category_l1: "Marketing", category_l2: "Content Production Services",          typical_unit: null },
  { category_l1: "Marketing", category_l2: "Marketing Analytics Services",         typical_unit: "monthly_subscription" },
  { category_l1: "Marketing", category_l2: "Influencer Campaign Management",       typical_unit: null },
];

interface Props {
  onSubmit: (data: RequestInput) => void;
  isRunning: boolean;
}

export default function RequestForm({ onSubmit, isRunning }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>(STATIC_CATEGORIES);
  const [form, setForm] = useState<RequestInput>(EXAMPLE);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setCategories(data as CategoryRow[]);
        // if DB is unavailable the API returns {error:...} — keep static fallback
      })
      .catch(() => { /* keep static fallback */ });
  }, []);

  const l1Options = useMemo(
    () => [...new Set(categories.map((c) => c.category_l1))],
    [categories],
  );
  const l2Options = useMemo(
    () => categories.filter((c) => c.category_l1 === form.category_l1).map((c) => c.category_l2),
    [categories, form.category_l1],
  );
  const unitHint = useMemo(
    () => categories.find((c) => c.category_l2 === form.category_l2)?.typical_unit ?? "",
    [categories, form.category_l2],
  );

  const set = <K extends keyof RequestInput>(key: K, value: RequestInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDeliveryCountry = (code: string) => {
    const current = form.delivery_countries ?? [];
    set(
      "delivery_countries",
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Purchase Request</h2>
        <button
          type="button"
          onClick={() => setForm(EXAMPLE)}
          className="px-3 py-1 text-xs rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Load Example
        </button>
      </div>

      {/* Category */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider">Category</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">L1 Category</label>
            <select
              value={form.category_l1}
              onChange={(e) => { set("category_l1", e.target.value); set("category_l2", ""); }}
              className={selectCls}
            >
              <option value="">Select…</option>
              {l1Options.map((l1) => <option key={l1} value={l1}>{l1}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">L2 Category</label>
            <select
              value={form.category_l2}
              onChange={(e) => set("category_l2", e.target.value)}
              className={selectCls}
              disabled={!form.category_l1}
            >
              <option value="">Select…</option>
              {l2Options.map((l2) => <option key={l2} value={l2}>{l2}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Requester context */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider">Requester Context</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Business Unit">
            <input type="text" value={form.business_unit} onChange={(e) => set("business_unit", e.target.value)} className={inputCls} />
          </FormField>
          <FormField label="Channel">
            <select value={form.request_channel} onChange={(e) => set("request_channel", e.target.value as RequestInput["request_channel"])} className={selectCls}>
              <option value="portal">Portal</option>
              <option value="teams">Teams</option>
              <option value="email">Email</option>
            </select>
          </FormField>
          <FormField label="Country">
            <select value={form.country} onChange={(e) => set("country", e.target.value)} className={selectCls}>
              {ALL_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Language">
            <select value={form.request_language} onChange={(e) => set("request_language", e.target.value as RequestInput["request_language"])} className={selectCls}>
              {(["en","fr","de","es","pt","ja"] as const).map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </FormField>
        </div>
      </fieldset>

      {/* Delivery countries */}
      <fieldset>
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Delivery Countries</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleDeliveryCountry(c.code)}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                form.delivery_countries?.includes(c.code)
                  ? "bg-sky-500/20 border-sky-500 text-sky-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {c.code}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Commercial */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider">Commercial</legend>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Currency">
            <select value={form.currency} onChange={(e) => set("currency", e.target.value as RequestInput["currency"])} className={selectCls}>
              <option value="EUR">EUR</option>
              <option value="CHF">CHF</option>
              <option value="USD">USD</option>
            </select>
          </FormField>
          <FormField label="Budget">
            <input
              type="number"
              value={form.budget_amount ?? ""}
              onChange={(e) => set("budget_amount", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Leave blank if unknown"
              className={inputCls}
            />
          </FormField>
          <FormField label={`Quantity${unitHint ? ` (${unitHint})` : ""}`}>
            <input
              type="number"
              value={form.quantity ?? ""}
              onChange={(e) => set("quantity", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Leave blank if unknown"
              className={inputCls}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Required By">
            <input
              type="date"
              value={form.required_by_date ?? ""}
              onChange={(e) => set("required_by_date", e.target.value || undefined)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Contract Type">
            <select value={form.contract_type_requested ?? ""} onChange={(e) => set("contract_type_requested", e.target.value || undefined)} className={selectCls}>
              <option value="">— Select —</option>
              <option value="purchase">Purchase</option>
              <option value="framework call-off">Framework call-off</option>
              <option value="rental">Rental</option>
            </select>
          </FormField>
        </div>
      </fieldset>

      {/* Suppliers */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider">Supplier Preferences</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Preferred Supplier">
            <input
              type="text"
              value={form.preferred_supplier_mentioned ?? ""}
              onChange={(e) => set("preferred_supplier_mentioned", e.target.value || undefined)}
              placeholder="Supplier name (optional)"
              className={inputCls}
            />
          </FormField>
          <FormField label="Incumbent Supplier">
            <input
              type="text"
              value={form.incumbent_supplier ?? ""}
              onChange={(e) => set("incumbent_supplier", e.target.value || undefined)}
              placeholder="Current supplier (optional)"
              className={inputCls}
            />
          </FormField>
        </div>
      </fieldset>

      {/* Constraints */}
      <fieldset>
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Constraints</legend>
        <div className="flex gap-6">
          <Toggle
            label="ESG Requirement"
            checked={form.esg_requirement}
            onChange={(v) => set("esg_requirement", v)}
          />
          <Toggle
            label="Data Residency Constraint"
            checked={form.data_residency_constraint}
            onChange={(v) => set("data_residency_constraint", v)}
          />
        </div>
      </fieldset>

      {/* Request text */}
      <fieldset>
        <legend className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Free-Text Request</legend>
        <textarea
          rows={3}
          value={form.request_text}
          onChange={(e) => set("request_text", e.target.value)}
          className={`${inputCls} resize-none`}
          placeholder="Original request text…"
        />
      </fieldset>

      {/* Submit */}
      <button
        type="submit"
        disabled={isRunning || !form.category_l1 || !form.category_l2}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-all bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
      >
        {isRunning ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Pipeline Running…
          </span>
        ) : (
          "Run Procurement Pipeline"
        )}
      </button>
    </form>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-sky-500" : "bg-slate-600"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </div>
      <span className="text-xs text-slate-300">{label}</span>
    </label>
  );
}

const selectCls =
  "w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors";
const inputCls =
  "w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-sky-500 transition-colors placeholder:text-slate-600";
