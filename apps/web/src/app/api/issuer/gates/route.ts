import { z } from "zod";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { AppError, handleApiError } from "@/lib/errors";
import { createGate, type CreateGateInput } from "@/server/jobgate.service";

const predicateSchema = z.object({ attribute: z.string(), equals: z.string() });
const assetSchema = z.object({ code: z.string(), issuer: z.string(), amount: z.string() });
const rewardConfigSchema = z.object({ asset: assetSchema }).partial({ asset: true });

const isoDatetimeOrDate = z.string().refine(
  (v) => !v || !isNaN(Date.parse(v)),
  { message: "Invalid date format" }
);

const createGateInputSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  requiredPredicates: z.array(predicateSchema).min(1),
  rewardType: z.enum(["CLAIMABLE_BALANCE", "FLAG"]),
  rewardConfig: rewardConfigSchema,
  expiresAt: isoDatetimeOrDate.nullable(),
});

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
    await requireAdmin();
    const ip = clientIp(req);
    const rl = await rateLimit(`gate:${ip}`, 20, 60);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many gate creation requests" } }),
        { status: 429, headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) } },
      );
    }
    const json: unknown = await req.json().catch(() => {
      throw new AppError("BAD_JSON", 422, "Invalid JSON body");
    });
    const parsed = createGateInputSchema.safeParse(json);
    if (!parsed.success) throw new AppError("VALIDATION", 422, parsed.error.issues[0]?.message ?? "Invalid input");

    const input: CreateGateInput = {
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description,
      requiredPredicates: parsed.data.requiredPredicates,
      rewardType: parsed.data.rewardType,
      rewardConfig: parsed.data.rewardConfig,
      expiresAt: parsed.data.expiresAt,
    };

    const gate = await createGate(input);
    return Response.json(gate, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
