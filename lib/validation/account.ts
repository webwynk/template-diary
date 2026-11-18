import { z } from "zod";

export const changePasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, { message: "Use at least 10 characters." })
      .max(200, { message: "That password is too long." }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords don't match.",
    path: ["confirm"],
  });
