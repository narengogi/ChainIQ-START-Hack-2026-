import { NextResponse } from "next/server";
import { query } from "@/src/db/mysql";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      country?: string; region?: string; countries?: string[];
      rule_type?: string; rule_text: string; applies_to?: string[];
    };
    await query(
      "UPDATE geography_rules SET country=?, region=?, countries=?, rule_type=?, rule_text=?, applies_to=? WHERE rule_id=?",
      [
        body.country ?? null, body.region ?? null,
        body.countries?.length ? JSON.stringify(body.countries) : null,
        body.rule_type ?? null,
        body.rule_text,
        body.applies_to?.length ? JSON.stringify(body.applies_to) : null,
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
    await query("DELETE FROM geography_rules WHERE rule_id=?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
