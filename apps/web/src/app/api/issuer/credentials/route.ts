import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { AppError, handleApiError } from "@/lib/errors";
import { mintInputSchema } from "@/lib/schemas/credential";
import { mintCredential, type MintInput } from "@/server/credential.service";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new AppError("UNAUTHENTICATED", 401, "Sign in to continue");
  if (session.user.role !== "ADMIN") throw new AppError("FORBIDDEN", 403, "Issuer access required");
  return session.user;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireAdmin();
    const ip = clientIp(req);
    const rl = await rateLimit(`mint:${ip}`, 60, 60);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many mint requests" } }),
        { status: 429, headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) } },
      );
    }
    const json: unknown = await req.json().catch(() => {
      throw new AppError("BAD_JSON", 422, "Invalid JSON body");
    });
    const parsed = mintInputSchema.safeParse(json);
    if (!parsed.success) throw new AppError("VALIDATION", 422, parsed.error.issues[0]?.message ?? "Invalid input");

    const jobId = randomUUID();
    const summary = await mintCredential(parsed.data as MintInput, {
      actorUserId: user.id,
      ip,
      jobId,
    });
    return Response.json({ ...summary, jobId });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const take = Math.min(Number(url.searchParams.get("take") ?? 25), 100);
    const skip = Math.max(Number(url.searchParams.get("skip") ?? 0), 0);
    const where = q ? { OR: [{ id: { contains: q } }, { merkleRootHex: { contains: q } }] } : {};
    const [items, total] = await Promise.all([
      db.credential.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: { id: true, leafIndex: true, merkleRootHex: true, status: true, createdAt: true },
      }),
      db.credential.count({ where }),
    ]);
    return Response.json({ items, total, take, skip });
  } catch (e) {
    return handleApiError(e);
  }
}
