import "server-only";
import { NextResponse } from "next/server";
import { AppError, toErrorResponse } from "../../../../../lib/errors";
import { getGate } from "../../../../../server/jobgate.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await ctx.params;
    const gate = await getGate(slug);
    if (!gate) throw new AppError("GATE_NOT_FOUND", 404, "No such job gate.");
    return NextResponse.json({ gate });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
