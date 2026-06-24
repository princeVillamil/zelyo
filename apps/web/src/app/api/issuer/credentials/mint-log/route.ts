import { auth } from "@/auth";
import { redisSubscriber } from "@/lib/redis";
import { AppError, handleApiError } from "@/lib/errors";
import { mintLogChannel } from "@/server/mintlog";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) throw new AppError("UNAUTHENTICATED", 401, "Sign in to continue");
    if (session.user.role !== "ADMIN") throw new AppError("FORBIDDEN", 403, "Issuer access required");

    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId || !/^[\w-]{1,64}$/.test(jobId)) throw new AppError("VALIDATION", 422, "Missing or invalid jobId");

    const channel = mintLogChannel(jobId);
    const sub = redisSubscriber();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        await sub.subscribe(channel);
        sub.on("message", (ch: string, message: string) => {
          if (ch !== channel) return;
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          try {
            const parsed = JSON.parse(message) as { event?: string };
            if (parsed.event === "SEALED") controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
          } catch {
            /* ignore malformed frames */
          }
        });
        // Keep-alive comment every 15s so proxies don't drop the connection.
        const ka = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
        req.signal.addEventListener("abort", () => {
          clearInterval(ka);
          void sub.unsubscribe(channel).then(() => sub.quit());
          controller.close();
        });
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
