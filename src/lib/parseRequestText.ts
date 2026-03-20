/**
 * SERVER-ONLY — contains the OpenAI client.
 * Never import this file from a "use client" component.
 */
import OpenAI from "openai";
import type { RequestInput } from "../pipeline/types";
import type { ParseResult } from "./requestHelpers";

const getClient = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a procurement request parser. Extract structured fields from the user's free-text procurement request. (the request can be in German and French as well as English)

Current date is ${new Date()}

Available category_l1 values (and their exact category_l2 children — use these EXACT strings):
- IT: Laptops, Mobile Workstations, Desktop Workstations, Monitors, Docking Stations, Smartphones, Tablets, Rugged Devices, Accessories Bundles, Replacement / Break-Fix Pool Devices, Cloud Compute, Cloud Storage, Cloud Networking, Managed Cloud Platform Services, Cloud Security Services
- Facilities: Workstations and Desks, Office Chairs, Meeting Room Furniture, Storage Cabinets, Reception and Lounge Furniture
- Professional Services: Cloud Architecture Consulting, Cybersecurity Advisory, Data Engineering Services, Software Development Services, IT Project Management Services
- Marketing: Search Engine Marketing (SEM), Social Media Advertising, Content Production Services, Marketing Analytics Services, Influencer Campaign Management

IMPORTANT: Always map to the EXACT category_l2 string listed above. For example:
- "IT project management", "IT PM support", "project management consulting" → category_l1: "Professional Services", category_l2: "IT Project Management Services"
- "cloud consulting", "cloud architecture" → category_l1: "Professional Services", category_l2: "Cloud Architecture Consulting"
- "software dev", "development services" → category_l1: "Professional Services", category_l2: "Software Development Services"

Return ONLY a JSON object with this shape:
{
  "category_l1": string | null,
  "category_l2": string | null,
  "title": string | null,
  "request_text": string (the original text as-is),
  "currency": "EUR" | "CHF" | "USD" | null,
  "budget_amount": number | null,
  "quantity": number | null,
  "unit_of_measure": string | null,
  "required_by_date": "YYYY-MM-DD" | null,
  "delivery_countries": string[] | null,
  "preferred_supplier_mentioned": string | null,
  "incumbent_supplier": string | null,
  "contract_type_requested": string | null,
  "data_residency_constraint": boolean,
  "esg_requirement": boolean,
  "business_unit": string | null,
  "country": string | null,
  "request_channel": "portal" | "teams" | "email" | null,
  "request_language": "en" | "fr" | "de" | "es" | "pt" | "ja" | null,
  "summary": string (one sentence summarising the request),
  "confidence": number (0.0 to 1.0, how confident you are in the extraction)
}

Rules:
- Use null for fields you cannot determine.
- delivery_countries must be 2-letter ISO codes (DE, FR, US, CH, etc).
- If the requester mentions a country name, convert it to the ISO code.
- budget_amount must be a plain number (no currency symbol).
- required_by_date must be YYYY-MM-DD.
- Infer currency from country if not stated (CH→CHF, US→USD, otherwise EUR).
- Infer delivery_countries from the requester's country or mentions if not stated.
- request_language: detect the language of the text.
- data_residency_constraint: true if text mentions data residency, GDPR data localisation, or in-country data storage.
- esg_requirement: true if text mentions sustainability, ESG, carbon, green, or social responsibility.`;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function parseRequestText(text: string): Promise<ParseResult> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model:           "gpt-4o",
    response_format: { type: "json_object" },
    temperature:     0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: text },
    ],
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}") as Record<string, unknown>;

  const parsed: Partial<RequestInput> = {
    category_l1:                  (raw.category_l1 as string) ?? undefined,
    category_l2:                  (raw.category_l2 as string) ?? undefined,
    title:                        (raw.title as string) ?? "Untitled Request",
    request_text:                 (raw.request_text as string) ?? text,
    currency:                     (raw.currency as RequestInput["currency"]) ?? undefined,
    budget_amount:                typeof raw.budget_amount === "number" ? raw.budget_amount : null,
    quantity:                     typeof raw.quantity === "number" ? raw.quantity : null,
    unit_of_measure:              (raw.unit_of_measure as string) ?? undefined,
    required_by_date:             (raw.required_by_date as string) ?? undefined,
    delivery_countries:           Array.isArray(raw.delivery_countries) ? (raw.delivery_countries as string[]) : [],
    preferred_supplier_mentioned: (raw.preferred_supplier_mentioned as string) ?? undefined,
    incumbent_supplier:           (raw.incumbent_supplier as string) ?? undefined,
    contract_type_requested:      (raw.contract_type_requested as string) ?? undefined,
    data_residency_constraint:    Boolean(raw.data_residency_constraint),
    esg_requirement:              Boolean(raw.esg_requirement),
    business_unit:                (raw.business_unit as string) ?? "General",
    country:                      (raw.country as string) ?? "DE",
    request_channel:              (raw.request_channel as RequestInput["request_channel"]) ?? "portal",
    request_language:             (raw.request_language as RequestInput["request_language"]) ?? "en",
  };

  // Determine which fields are missing or incomplete
  const { FIELD_DEFS } = await import("./requestHelpers");
  const missing = [];

  for (const field of Object.keys(FIELD_DEFS)) {
    const def = FIELD_DEFS[field];
    const value = parsed[field as keyof RequestInput];

    const isEmpty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      missing.push({ field, label: def.label, question: def.question, required: def.required });
    }
  }

  return {
    parsed,
    missing,
    summary:    (raw.summary as string) ?? "Procurement request",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
  };
}
