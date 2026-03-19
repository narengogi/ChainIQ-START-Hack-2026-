import { NextResponse } from "next/server";
import { parseRequestText } from "@/src/lib/parseRequestText";

export async function POST(req: Request): Promise<Response> {
  try {
    const { text } = (await req.json()) as { text: string };

    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json({ error: "Please provide a longer description." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. Add it to .env.local." },
        { status: 503 },
      );
    }

    const result = await parseRequestText(text.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parsing failed" },
      { status: 500 },
    );
  }
}
