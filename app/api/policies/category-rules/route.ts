import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function GET() {
  try {
    const rows = await query("SELECT * FROM category_rules ORDER BY rule_id");
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      category_l1: string; category_l2: string; rule_type: string; rule_text: string;
    };

    // Auto-generate rule_id as CR-NNN
    const [{ maxId }] = await query<{ maxId: string | null }>(
      "SELECT MAX(CAST(SUBSTRING(rule_id, 4) AS UNSIGNED)) as maxId FROM category_rules WHERE rule_id REGEXP '^CR-'",
    );
    const next = (Number(maxId ?? 0) + 1).toString().padStart(3, "0");
    const rule_id = `CR-${next}`;

    await query(
      "INSERT INTO category_rules (rule_id, category_l1, category_l2, rule_type, rule_text) VALUES (?, ?, ?, ?, ?)",
      [rule_id, body.category_l1, body.category_l2, body.rule_type, body.rule_text],
    );
    return NextResponse.json({ rule_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
