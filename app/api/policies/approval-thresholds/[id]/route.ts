import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      currency: string; min_amount: number; max_amount: number | null;
      min_supplier_quotes: number; managed_by: string[];
      deviation_approval_required_from: string[]; policy_note?: string;
    };
    await query(
      `UPDATE approval_thresholds SET currency=?, min_amount=?, max_amount=?,
        min_supplier_quotes=?, managed_by=?, deviation_approval_required_from=?, policy_note=?
       WHERE threshold_id=?`,
      [
        body.currency, body.min_amount, body.max_amount ?? null,
        body.min_supplier_quotes,
        JSON.stringify(body.managed_by),
        JSON.stringify(body.deviation_approval_required_from),
        body.policy_note ?? null,
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
    await query("DELETE FROM approval_thresholds WHERE threshold_id=?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
