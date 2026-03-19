/**
 * Client-safe helpers for the request parsing flow.
 * This file must NOT import OpenAI or any server-only packages.
 */
import type { RequestInput } from "../pipeline/types";

// ---------------------------------------------------------------------------
// Types (re-exported so UI can use them without touching the OpenAI module)
// ---------------------------------------------------------------------------

export interface MissingField {
  field:    string;
  label:    string;
  question: string;
  required: boolean;
}

export interface ParseResult {
  parsed:     Partial<RequestInput>;
  missing:    MissingField[];
  summary:    string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

export const FIELD_DEFS: Record<string, { label: string; question: string; required: boolean }> = {
  category_l1:       { label: "Product / Service Category (L1)",  question: "What is the high-level category? (e.g. IT, Facilities, HR, Marketing, Professional Services)", required: true  },
  category_l2:       { label: "Sub-category (L2)",               question: "What specific sub-category? (e.g. Laptops, Docking Stations, Recruitment Services)", required: true  },
  currency:          { label: "Currency",                         question: "What currency should be used? (EUR, CHF, or USD)",                                  required: true  },
  delivery_countries:{ label: "Delivery Countries",              question: "Which countries need delivery? (e.g. DE, FR, US — use 2-letter codes)",             required: true  },
  budget_amount:     { label: "Budget Amount",                    question: "What is the total budget for this request?",                                         required: false },
  quantity:          { label: "Quantity",                         question: "How many units are required?",                                                       required: false },
  unit_of_measure:   { label: "Unit of Measure",                 question: "What is the unit of measure? (e.g. device, license, seat, month)",                   required: false },
  required_by_date:  { label: "Required By Date",                question: "What is the delivery deadline? (YYYY-MM-DD format)",                                  required: false },
  business_unit:     { label: "Business Unit",                   question: "Which business unit is making this request?",                                         required: false },
  country:           { label: "Requester Country",               question: "Which country is the requester based in? (2-letter code)",                            required: false },
};

export const REQUIRED_FIELDS = Object.entries(FIELD_DEFS)
  .filter(([, def]) => def.required)
  .map(([field]) => field);

// ---------------------------------------------------------------------------
// Merge parsed fields + user-supplied answers into a complete RequestInput
// ---------------------------------------------------------------------------

export function mergeAnswers(
  parsed: Partial<RequestInput>,
  answers: Record<string, string>,
): Partial<RequestInput> {
  const merged = { ...parsed };

  for (const [field, value] of Object.entries(answers)) {
    if (!value.trim()) continue;

    if (field === "delivery_countries") {
      (merged as Record<string, unknown>)[field] = value
        .split(/[,\s]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
    } else if (field === "budget_amount" || field === "quantity") {
      const num = parseFloat(value.replace(/[^0-9.]/g, ""));
      if (!isNaN(num)) (merged as Record<string, unknown>)[field] = num;
    } else {
      (merged as Record<string, unknown>)[field] = value.trim();
    }
  }

  return merged;
}
