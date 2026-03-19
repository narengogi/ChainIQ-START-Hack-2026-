import { query } from "@/src/db/mysql";
import { NextRequest, NextResponse } from "next/server";

interface SupplierNameRow {
  supplier_id:   string;
  supplier_name: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const categoryL2 = req.nextUrl.searchParams.get("category_l2");
  try {
    const rows = await query<SupplierNameRow>(
      `SELECT DISTINCT supplier_id, supplier_name
       FROM suppliers
       ${categoryL2 ? "WHERE category_l2 = ?" : ""}
       ORDER BY supplier_name`,
      categoryL2 ? [categoryL2] : [],
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
