import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { AppError, handleApiError } from "@/lib/errors";
import { revokeCredential } from "@/server/credential.service";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) throw new AppError("UNAUTHENTICATED", 401, "Sign in to continue");
    if (session.user.role !== "ADMIN") throw new AppError("FORBIDDEN", 403, "Issuer access required");

    const ip = clientIp(req);
    const rl = await rateLimit(`mint:${ip}`, 60, 60);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
      });
    }
    const { id } = await params;
    if (!/^[a-z0-9]{20,40}$/.test(id)) throw new AppError("VALIDATION", 422, "Invalid credential id");
    const result = await revokeCredential(id, { actorUserId: session.user.id, ip });
    return Response.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
