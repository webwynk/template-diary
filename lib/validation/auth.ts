import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Enter a valid email address." })),
  password: z
    .string()
    .min(1, { message: "Enter your password." })
    .max(200, { message: "That password is too long." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
