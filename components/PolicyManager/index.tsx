"use client";

import { useState } from "react";
import { TabBar } from "./shared";
import CategoryRulesTab      from "./CategoryRulesTab";
import ApprovalThresholdsTab from "./ApprovalThresholdsTab";
import EscalationRulesTab    from "./EscalationRulesTab";
import GeographyRulesTab     from "./GeographyRulesTab";
import PreferredSuppliersTab from "./PreferredSuppliersTab";
import RestrictedSuppliersTab from "./RestrictedSuppliersTab";

type Tab =
  | "category-rules"
  | "approval-thresholds"
  | "escalation-rules"
  | "geography-rules"
  | "preferred-suppliers"
  | "restricted-suppliers";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "category-rules",       label: "Category Rules",      icon: "📂" },
  { id: "approval-thresholds",  label: "Approval Thresholds", icon: "💰" },
  { id: "escalation-rules",     label: "Escalation Rules",    icon: "🚨" },
  { id: "geography-rules",      label: "Geography Rules",     icon: "🌍" },
  { id: "preferred-suppliers",  label: "Preferred Suppliers", icon: "⭐" },
  { id: "restricted-suppliers", label: "Restricted Suppliers",icon: "🚫" },
];

export default function PolicyManager() {
  const [activeTab, setActiveTab] = useState<Tab>("category-rules");

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-1">
        <div className="mb-5">
          <h2 className="text-base font-bold text-white" style={{ fontFamily: "Montserrat, Inter, system-ui", letterSpacing: "-0.01em" }}>Policy Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, edit and delete procurement policies. Changes take effect on the next pipeline run.
          </p>
        </div>

        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === "category-rules"       && <CategoryRulesTab />}
          {activeTab === "approval-thresholds"  && <ApprovalThresholdsTab />}
          {activeTab === "escalation-rules"     && <EscalationRulesTab />}
          {activeTab === "geography-rules"      && <GeographyRulesTab />}
          {activeTab === "preferred-suppliers"  && <PreferredSuppliersTab />}
          {activeTab === "restricted-suppliers" && <RestrictedSuppliersTab />}
        </div>
      </div>
    </div>
  );
}
