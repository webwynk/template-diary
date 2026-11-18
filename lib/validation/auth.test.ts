import { loginSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("normalises the email", () => {
    const result = loginSchema.parse({ email: "  WebWynk@Gmail.com ", password: "x" });
    expect(result.email).toBe("webwynk@gmail.com");
  });

  it("rejects a bad email and an empty password", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rejects missing fields (FormData.get returns null)", () => {
    expect(loginSchema.safeParse({ email: null, password: null }).success).toBe(false);
  });
});
