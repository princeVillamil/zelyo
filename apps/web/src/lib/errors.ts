export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "AppError";
  }
}

export type ErrorBody = { error: { code: string; message: string } };

export function toErrorResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.httpStatus,
      body: { error: { code: err.code, message: err.publicMessage } },
    };
  }
  // Unknown errors: never leak the message/stack/DB detail.
  return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong" } } };
}

/** Map any thrown error to a JSON Response (adds Retry-After on 429). */
export function handleApiError(err: unknown): Response {
  const { status, body } = toErrorResponse(err);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 429) {
    headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
  }
  return new Response(JSON.stringify(body), { status, headers });
}
