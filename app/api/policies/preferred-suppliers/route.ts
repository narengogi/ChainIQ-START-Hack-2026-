import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function GET() {
  try {
    const rows = await query("SELECT * FROM preferred_suppliers ORDER BY supplier_name, category_l2");
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      supplier_id: string; supplier_name: string;
      category_l1: string; category_l2: string;
      region_scope?: string[]; policy_note?: string;
    };
    await query(
      "INSERT INTO preferred_suppliers (supplier_id, supplier_name, category_l1, category_l2, region_scope, policy_note) VALUES (?, ?, ?, ?, ?, ?)",
      [
        body.supplier_id, body.supplier_name, body.category_l1, body.category_l2,
        body.region_scope?.length ? JSON.stringify(body.region_scope) : null,
        body.policy_note ?? null,
      ],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
