import { query } from "@/src/db/mysql";
import { NextResponse } from "next/server";

interface CategoryRow {
  category_l1:  string;
  category_l2:  string;
  typical_unit: string | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const rows = await query<CategoryRow>(
      `SELECT category_l1, category_l2, typical_unit
       FROM categories
       ORDER BY category_l1, category_l2`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
