import { z } from "zod";

export const credentialsSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ and - only"),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
