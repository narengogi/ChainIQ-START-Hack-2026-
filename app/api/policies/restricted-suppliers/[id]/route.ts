import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      supplier_id: string; supplier_name: string;
      category_l1: string; category_l2: string;
      restriction_scope: string[]; restriction_reason: string;
    };
    await query(
      "UPDATE restricted_suppliers SET supplier_id=?, supplier_name=?, category_l1=?, category_l2=?, restriction_scope=?, restriction_reason=? WHERE id=?",
      [
        body.supplier_id, body.supplier_name, body.category_l1, body.category_l2,
        JSON.stringify(body.restriction_scope),
        body.restriction_reason,
        id,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("DELETE FROM restricted_suppliers WHERE id=?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
