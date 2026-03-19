import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      category_l1: string; category_l2: string; rule_type: string; rule_text: string;
    };
    await query(
      "UPDATE category_rules SET category_l1=?, category_l2=?, rule_type=?, rule_text=? WHERE rule_id=?",
      [body.category_l1, body.category_l2, body.rule_type, body.rule_text, id],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("DELETE FROM category_rules WHERE rule_id=?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
