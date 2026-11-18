import { imageUrlSchema, swapListSchema, swapSchema } from "@/lib/validation/swaps";

describe("swap schemas", () => {
  it("accepts valid swaps and trims values", () => {
    expect(swapSchema.parse({ kind: "color", fromRgb: "#4F46E5", to: " #10b981 " })).toEqual({
      kind: "color",
      fromRgb: "#4F46E5",
      to: "#10b981",
    });
    expect(
      swapSchema.parse({ kind: "font", fromFamily: " Inter ", to: " DM Sans " }),
    ).toMatchObject({
      fromFamily: "Inter",
      to: "DM Sans",
    });
    expect(imageUrlSchema.parse(" https://a.test/x.jpg?w=1&h=2 ")).toBe(
      "https://a.test/x.jpg?w=1&h=2",
    );
  });

  it("rejects invalid swaps", () => {
    expect(swapSchema.safeParse({ kind: "color", fromRgb: "#4f46e5", to: "#4f46e" }).success).toBe(
      false,
    );
    expect(swapSchema.safeParse({ kind: "font", fromFamily: "Inter", to: "<b>" }).success).toBe(
      false,
    );
    expect(swapSchema.safeParse({ kind: "image", fromUrl: "", to: "https://a.test" }).success).toBe(
      false,
    );
    expect(swapSchema.safeParse({ kind: "nope" }).success).toBe(false);
    expect(imageUrlSchema.safeParse("https://").success).toBe(false);
    expect(imageUrlSchema.safeParse(`https://a.test/${"x".repeat(2000)}`).success).toBe(false);
  });

  it("rejects the same item swapped twice", () => {
    const twice = (a: object, b: object) => swapListSchema.safeParse([a, b]).success;
    expect(
      twice(
        { kind: "image", fromUrl: "a", to: "https://x.test" },
        { kind: "image", fromUrl: "a", to: "https://y.test" },
      ),
    ).toBe(false);
    expect(
      twice(
        { kind: "font", fromFamily: "Inter", to: "A" },
        { kind: "font", fromFamily: "inter", to: "B" },
      ),
    ).toBe(false);
    expect(
      twice(
        { kind: "font", fromFamily: "Inter", to: "A" },
        { kind: "image", fromUrl: "Inter", to: "https://y.test" },
      ),
    ).toBe(true);
  });
});
