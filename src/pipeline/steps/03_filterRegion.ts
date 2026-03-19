import type { EmitFn, PipelineState } from "../types";

// Region → countries mapping (used to translate delivery country to pricing region)
export const COUNTRY_TO_REGION: Record<string, string> = {
  DE: "EU", FR: "EU", NL: "EU", BE: "EU", AT: "EU", IT: "EU",
  ES: "EU", PL: "EU", UK: "EU", CH: "EU",
  US: "Americas", CA: "Americas", BR: "Americas", MX: "Americas",
  SG: "APAC",     AU: "APAC",    IN: "APAC",      JP: "APAC",
  UAE: "MEA",     ZA: "MEA",
};

export async function filterRegion(state: PipelineState, emit: EmitFn): Promise<void> {
  const deliveryCountries = state.request.delivery_countries;
  const surviving: typeof state.active = [];

  for (const supplier of state.active) {
    const regions = supplier.service_regions.split(";").map((r) => r.trim());
    const coversAll = deliveryCountries.every((country) => regions.includes(country));

    if (coversAll) {
      surviving.push(supplier);
    } else {
      const missing = deliveryCountries.filter((c) => !regions.includes(c));
      const reason = `Does not serve delivery ${missing.length > 1 ? "countries" : "country"}: ${missing.join(", ")}`;
      state.eliminated.push({ supplier, reason, ruleId: "GEO-REGION" });
      await emit({
        type: "SUPPLIER_ELIMINATED",
        data: { supplierId: supplier.supplier_id, name: supplier.supplier_name, reason, ruleId: "GEO-REGION", step: "Region Filter" },
      });
    }
  }

  state.active = surviving;
}
