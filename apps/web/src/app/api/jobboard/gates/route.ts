import "server-only";
import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../lib/errors";
import { listGates } from "../../../../server/jobgate.service";

export async function GET(): Promise<Response> {
  try {
    const gates = await listGates();
    return NextResponse.json({ gates });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
