import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function GET() {
  try {
    const rows = await query("SELECT * FROM approval_thresholds ORDER BY currency, min_amount");
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      currency: string; min_amount: number; max_amount: number | null;
      min_supplier_quotes: number; managed_by: string[];
      deviation_approval_required_from: string[]; policy_note?: string;
    };

    const [{ maxId }] = await query<{ maxId: string | null }>(
      "SELECT MAX(CAST(SUBSTRING(threshold_id, 4) AS UNSIGNED)) as maxId FROM approval_thresholds WHERE threshold_id REGEXP '^AT-'",
    );
    const next = (Number(maxId ?? 0) + 1).toString().padStart(3, "0");
    const threshold_id = `AT-${next}`;

    await query(
      `INSERT INTO approval_thresholds
        (threshold_id, currency, min_amount, max_amount, min_supplier_quotes, managed_by, deviation_approval_required_from, policy_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        threshold_id, body.currency, body.min_amount, body.max_amount ?? null,
        body.min_supplier_quotes,
        JSON.stringify(body.managed_by),
        JSON.stringify(body.deviation_approval_required_from),
        body.policy_note ?? null,
      ],
    );
    return NextResponse.json({ threshold_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
