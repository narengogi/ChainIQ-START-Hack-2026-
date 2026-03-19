import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function GET() {
  try {
    const rows = await query("SELECT * FROM escalation_rules ORDER BY rule_id");
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      trigger_condition: string; action: string; escalate_to: string;
      applies_to_currencies?: string[];
    };

    const [{ maxId }] = await query<{ maxId: string | null }>(
      "SELECT MAX(CAST(SUBSTRING(rule_id, 4) AS UNSIGNED)) as maxId FROM escalation_rules WHERE rule_id REGEXP '^ER-'",
    );
    const next = (Number(maxId ?? 0) + 1).toString().padStart(3, "0");
    const rule_id = `ER-${next}`;

    await query(
      "INSERT INTO escalation_rules (rule_id, trigger_condition, action, escalate_to, applies_to_currencies) VALUES (?, ?, ?, ?, ?)",
      [rule_id, body.trigger_condition, body.action, body.escalate_to,
       body.applies_to_currencies?.length ? JSON.stringify(body.applies_to_currencies) : null],
    );
    return NextResponse.json({ rule_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
