import "server-only";
import { hash } from "@node-rs/argon2";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { RegisterInput } from "../lib/validation/auth";

export async function registerHolder(
  input: RegisterInput,
): Promise<{ id: string; username: string }> {
  // @node-rs/argon2 defaults to Argon2id.
  const passwordHash = await hash(input.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  try {
    const user = await db.user.create({
      data: { username: input.username, passwordHash, role: "HOLDER" },
      select: { id: true, username: true },
    });
    return user;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new AppError("USERNAME_TAKEN", 409, "That username is already taken.");
    }
    throw e;
  }
}
