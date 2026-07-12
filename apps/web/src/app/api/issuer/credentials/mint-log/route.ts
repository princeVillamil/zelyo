import { auth } from "@/auth";
import { redis, redisSubscriber } from "@/lib/redis";
import { AppError, handleApiError } from "@/lib/errors";
import { mintLogChannel, mintLogHistoryKey } from "@/server/mintlog";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) throw new AppError("UNAUTHENTICATED", 401, "Sign in to continue");
    if (session.user.role !== "ADMIN") throw new AppError("FORBIDDEN", 403, "Issuer access required");

    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId || !/^[\w-]{1,64}$/.test(jobId)) throw new AppError("VALIDATION", 422, "Missing or invalid jobId");

    const channel = mintLogChannel(jobId);
    const historyKey = mintLogHistoryKey(jobId);
    const sub = redisSubscriber();
    const encoder = new TextEncoder();

    let isClosed = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // 1. Replay historical logs.
        try {
          const history = await redis.lrange(historyKey, 0, -1);
          for (const msg of history) {
            if (isClosed) return;
            controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            const parsed = JSON.parse(msg) as { event?: string };
            if (parsed.event === "SEALED") {
              controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            }
          }
        } catch {
          /* ignore history fetch error */
        }

        // 2. Subscribe to new logs.
        await sub.subscribe(channel);
        sub.on("message", (ch: string, message: string) => {
          if (ch !== channel || isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            const parsed = JSON.parse(message) as { event?: string };
            if (parsed.event === "SEALED") {
              controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            }
          } catch {
            /* ignore */
          }
        });

        // Keep-alive comment every 15s so proxies don't drop the connection.
        const ka = setInterval(() => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            /* ignore */
          }
        }, 15_000);

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(ka);
          void sub.unsubscribe(channel).then(() => sub.quit()).catch(() => {});
          try {
            controller.close();
          } catch {
            /* ignore if already closed */
          }
        };

        req.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
