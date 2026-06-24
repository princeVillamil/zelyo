import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerHolder } from "@/server/holder.service";
import { AppError, toErrorResponse } from "@/lib/errors";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    await consumeOrThrow(limiters.register, clientIp(request.headers));

    const json = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("VALIDATION", 400, "Invalid registration details.");
    }

    const user = await registerHolder(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers =
      status === 429
        ? { "Retry-After": String((err as { retryAfter?: number }).retryAfter ?? 60) }
        : undefined;
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
