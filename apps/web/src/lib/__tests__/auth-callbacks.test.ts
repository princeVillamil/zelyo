import { describe, it, expect } from "vitest";
import { authConfig } from "../../../auth.config";

describe("auth callbacks", () => {
  it("threads userId + role into the JWT and session", async () => {
    const jwt = authConfig.callbacks!.jwt!;
    const session = authConfig.callbacks!.session!;

    const token = await jwt({
      token: {},
      user: { id: "u1", username: "admin", role: "ADMIN" },
    } as never);
    expect(token).toMatchObject({ userId: "u1", role: "ADMIN" });

    const sess = await session({
      session: { user: {} },
      token: { userId: "u1", role: "ADMIN" },
    } as never);
    expect((sess as { user: { id: string; role: string } }).user).toMatchObject({
      id: "u1",
      role: "ADMIN",
    });
  });
});
