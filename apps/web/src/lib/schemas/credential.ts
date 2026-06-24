import { z } from "zod";

const fieldHex = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, "must be 0x-prefixed 32-byte lowercase hex");

export const attributesSchema = z.object({
  track: z.string().min(1).max(120),
  grade: z.string().min(1).max(40),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO date YYYY-MM-DD"),
  courseName: z.string().min(1).max(200),
  learnerName: z.string().min(1).max(200),
});

export const mintInputSchema = z.object({
  holder: z
    .object({
      username: z.string().min(1).max(64).optional(),
      idCommitment: fieldHex.optional(),
    })
    .refine((h) => Boolean(h.username) !== Boolean(h.idCommitment), {
      message: "Provide exactly one of username or idCommitment",
    }),
  attributes: attributesSchema,
});

// Flat shape for react-hook-form on /issuer/mint.
export const mintFormSchema = z
  .object({
    learnerName: z.string().min(1, "Required").max(200),
    courseName: z.string().min(1, "Required").max(200),
    grade: z.string().min(1, "Required").max(40),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    track: z.string().min(1, "Required").max(120),
    targetMode: z.enum(["username", "idCommitment"]),
    username: z.string().max(64).optional(),
    idCommitment: z.string().regex(/^0x[0-9a-f]{64}$/).optional(),
  })
  .refine((v) => (v.targetMode === "username" ? Boolean(v.username) : Boolean(v.idCommitment)), {
    message: "Enter the target holder",
    path: ["username"],
  });

export type MintInputBody = z.infer<typeof mintInputSchema>;
export type MintFormValues = z.infer<typeof mintFormSchema>;

export function formValuesToMintInput(v: MintFormValues): MintInputBody {
  return {
    holder:
      v.targetMode === "username"
        ? { username: v.username }
        : { idCommitment: v.idCommitment },
    attributes: {
      track: v.track,
      grade: v.grade,
      issueDate: v.issueDate,
      courseName: v.courseName,
      learnerName: v.learnerName,
    },
  };
}
