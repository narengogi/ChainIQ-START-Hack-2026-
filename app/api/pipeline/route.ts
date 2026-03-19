import { runPipeline } from "@/src/pipeline/runner";
import type { PipelineEvent, RequestInput } from "@/src/pipeline/types";

const encode   = (s: string) => new TextEncoder().encode(s);
const sleep    = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const EVENT_DELAY_MS = Number(process.env.PIPELINE_EVENT_DELAY_MS ?? 200);

export async function POST(req: Request): Promise<Response> {
  let body: RequestInput;
  try {
    body = (await req.json()) as RequestInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = async (event: PipelineEvent): Promise<void> => {
        try {
          controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
          if (EVENT_DELAY_MS > 0) await sleep(EVENT_DELAY_MS);
        } catch {
          // controller may already be closed
        }
      };

      try {
        await runPipeline(body, emit);
      } catch (err) {
        await emit({ type: "ERROR", data: { message: String(err) } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
