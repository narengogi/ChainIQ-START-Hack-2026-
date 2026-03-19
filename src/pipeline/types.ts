// ---------------------------------------------------------------------------
// Shared domain types
// ---------------------------------------------------------------------------

export interface RequestInput {
  request_id?:                  string;
  created_at?:                  string;
  request_channel:              "portal" | "teams" | "email";
  request_language:             "en" | "fr" | "de" | "es" | "pt" | "ja";
  business_unit:                string;
  country:                      string;
  site?:                        string;
  requester_id?:                string;
  requester_role?:              string;
  submitted_for_id?:            string;
  category_l1:                  string;
  category_l2:                  string;
  title:                        string;
  request_text:                 string;
  currency:                     "EUR" | "CHF" | "USD";
  budget_amount:                number | null;
  quantity:                     number | null;
  unit_of_measure?:             string;
  required_by_date?:            string;
  preferred_supplier_mentioned?: string;
  incumbent_supplier?:          string;
  contract_type_requested?:     string;
  delivery_countries:           string[];
  data_residency_constraint:    boolean;
  esg_requirement:              boolean;
  status?:                      string;
  scenario_tags?:               string[];
}

export interface CandidateSupplier {
  supplier_id:               string;
  supplier_name:             string;
  category_l1:               string;
  category_l2:               string;
  country_hq:                string;
  service_regions:           string;
  currency:                  string;
  pricing_model:             string;
  quality_score:             number;
  risk_score:                number;
  esg_score:                 number;
  preferred_supplier:        boolean;
  is_restricted:             boolean;
  restriction_reason?:       string;
  contract_status:           string;
  data_residency_supported:  boolean;
  capacity_per_month?:       number;
}

export interface PricingTier {
  pricing_id:               string;
  supplier_id:              string;
  region:                   string;
  currency:                 string;
  min_quantity:             number;
  max_quantity:             number;
  unit_price:               number;
  moq:                      number;
  standard_lead_time_days:  number;
  expedited_lead_time_days?: number;
  expedited_unit_price?:    number;
}

export interface RankedSupplier extends CandidateSupplier {
  rank:                  number;
  pricing_tier:          PricingTier | null;
  unit_price:            number | null;
  total_price:           number | null;
  score:                 number;
  policy_compliant:      boolean;
  recommendation_note:   string;
  flags:                 string[];
}

export interface ApprovalThreshold {
  threshold_id:                    string;
  currency:                        string;
  min_amount:                      number;
  max_amount:                      number | null;
  min_supplier_quotes:             number;
  managed_by:                      string[];
  deviation_approval_required_from: string[];
  policy_note?:                    string;
}

export interface ValidationIssue {
  issue_id:        string;
  severity:        "critical" | "high" | "medium" | "low";
  type:            string;
  description:     string;
  action_required: string;
}

export interface Escalation {
  escalation_id: string;
  rule:          string;
  trigger:       string;
  escalate_to:   string;
  blocking:      boolean;
}

export interface FinalRecommendation {
  status:                       "can_proceed" | "cannot_proceed" | "escalation_required";
  reason:                       string;
  shortlist:                    RankedSupplier[];
  preferred_supplier_if_resolved?: string;
  minimum_budget_required?:     number;
  minimum_budget_currency?:     string;
  audit_trail: {
    policies_checked:        string[];
    supplier_ids_evaluated:  string[];
    pricing_tiers_applied:   string;
    data_sources_used:       string[];
    historical_context?:     string;
  };
}

// ---------------------------------------------------------------------------
// Pipeline accumulated state (passed between steps)
// ---------------------------------------------------------------------------

export interface PipelineState {
  request:             RequestInput;
  candidates:          CandidateSupplier[];
  active:              CandidateSupplier[];
  eliminated:          Array<{ supplier: CandidateSupplier; reason: string; ruleId?: string }>;
  flagged:             Array<{ supplierId: string; flag: string; severity: "warn" | "info" }>;
  threshold:           ApprovalThreshold | null;
  policiesApplied:     string[];
  validationIssues:    ValidationIssue[];
  shortlist:           RankedSupplier[];
  escalations:         Escalation[];
  recommendation:      FinalRecommendation | null;
}

// ---------------------------------------------------------------------------
// Streaming event union
// ---------------------------------------------------------------------------

export type PipelineEvent =
  | { type: "REQUEST_PARSED";      data: { interpretation: Omit<RequestInput, "request_text"> & { days_until_required: number | null } } }
  | { type: "CANDIDATE_POOL";      data: { suppliers: CandidateSupplier[]; count: number } }
  | { type: "SUPPLIER_ELIMINATED"; data: { supplierId: string; name: string; reason: string; ruleId?: string; step?: string } }
  | { type: "SUPPLIER_FLAGGED";    data: { supplierId: string; name: string; flag: string; severity: "warn" | "info" } }
  | { type: "POLICY_APPLIED";      data: { ruleId: string; description: string; category?: string } }
  | { type: "VALIDATION_ISSUE";    data: ValidationIssue }
  | { type: "STAGE_SUMMARY";       data: { stage: string; step: number; activeCount: number; eliminatedThisStep: number; totalEliminated: number } }
  | { type: "SHORTLIST";           data: { suppliers: RankedSupplier[]; quotesRequired: number; approver: string } }
  | { type: "ESCALATION";          data: Escalation }
  | { type: "RECOMMENDATION";      data: FinalRecommendation }
  | { type: "COMPLETE";            data: null }
  | { type: "ERROR";               data: { message: string } };

export type EmitFn = (event: PipelineEvent) => Promise<void>;
