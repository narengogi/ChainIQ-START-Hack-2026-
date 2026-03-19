import type { EmitFn, PipelineState } from "../types";

export async function filterCapacity(state: PipelineState, emit: EmitFn): Promise<void> {
  const { quantity } = state.request;
  if (quantity === null) return; // can't evaluate capacity without a quantity

  const surviving: typeof state.active = [];

  for (const supplier of state.active) {
    if (supplier.capacity_per_month === undefined || supplier.capacity_per_month === null) {
      surviving.push(supplier);
      continue;
    }

    if (quantity > supplier.capacity_per_month) {
      const reason = `Requested quantity (${quantity}) exceeds monthly capacity (${supplier.capacity_per_month})`;
      state.eliminated.push({ supplier, reason, ruleId: "ER-006" });
      await emit({
        type: "SUPPLIER_ELIMINATED",
        data: { supplierId: supplier.supplier_id, name: supplier.supplier_name, reason, ruleId: "ER-006", step: "Capacity Filter" },
      });
    } else {
      surviving.push(supplier);
    }
  }

  state.active = surviving;
}
