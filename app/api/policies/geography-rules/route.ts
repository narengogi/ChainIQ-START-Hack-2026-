import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function GET() {
  try {
    const rows = await query("SELECT * FROM geography_rules ORDER BY rule_id");
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      country?: string; region?: string; countries?: string[];
      rule_type?: string; rule_text: string; applies_to?: string[];
    };

    const [{ maxId }] = await query<{ maxId: string | null }>(
      "SELECT MAX(CAST(SUBSTRING(rule_id, 4) AS UNSIGNED)) as maxId FROM geography_rules WHERE rule_id REGEXP '^GR-'",
    );
    const next = (Number(maxId ?? 0) + 1).toString().padStart(3, "0");
    const rule_id = `GR-${next}`;

    await query(
      "INSERT INTO geography_rules (rule_id, country, region, countries, rule_type, rule_text, applies_to) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        rule_id,
        body.country ?? null,
        body.region ?? null,
        body.countries?.length ? JSON.stringify(body.countries) : null,
        body.rule_type ?? null,
        body.rule_text,
        body.applies_to?.length ? JSON.stringify(body.applies_to) : null,
      ],
    );
    return NextResponse.json({ rule_id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
