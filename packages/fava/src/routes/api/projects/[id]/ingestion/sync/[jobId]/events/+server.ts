import { json } from "@sveltejs/kit";
import { subscribeSyncJobEvents } from "$lib/server/sync-jobs";

const encoder = new TextEncoder();

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET({
  params,
}: {
  params: { id: string; jobId: string };
}) {
  try {
    const { events } = await subscribeSyncJobEvents(params.id, params.jobId);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) {
            controller.enqueue(
              encoder.encode(`${JSON.stringify(event)}\n`),
            );
            if (
              event.type === "done" ||
              event.type === "error"
            ) {
              break;
            }
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                job: {
                  id: params.jobId,
                  projectId: params.id,
                  sourceId: "",
                  status: "failed",
                  startedAt: new Date().toISOString(),
                  error: message(error),
                  progress: {
                    stage: "complete",
                    message: message(error),
                  },
                  runIds: [],
                },
              })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const text = message(error);
    const status = text.startsWith("Unknown sync job") ? 404 : 400;
    return json({ error: text }, { status });
  }
}
