import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      trigger_condition: string; action: string; escalate_to: string;
      applies_to_currencies?: string[];
    };
    await query(
      "UPDATE escalation_rules SET trigger_condition=?, action=?, escalate_to=?, applies_to_currencies=? WHERE rule_id=?",
      [body.trigger_condition, body.action, body.escalate_to,
       body.applies_to_currencies?.length ? JSON.stringify(body.applies_to_currencies) : null,
       id],
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query("DELETE FROM escalation_rules WHERE rule_id=?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
