import { templateDetailsSchema } from "@/lib/validation/templates";

const TAG = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";

describe("templateDetailsSchema", () => {
  it("trims, dedupes tags and turns empty optional fields into null", () => {
    expect(
      templateDetailsSchema.parse({
        name: "  Hero dark ",
        type: "custom",
        tagIds: [TAG, TAG],
        notes: "  ",
        usedIn: "",
      }),
    ).toEqual({ name: "Hero dark", type: "custom", tagIds: [TAG], notes: null, usedIn: null });
    expect(templateDetailsSchema.parse({ name: "x", type: "elementor", tagIds: [] })).toMatchObject(
      {
        notes: null,
        usedIn: null,
      },
    );
  });

  it.each([
    [{ name: " ", type: "custom", tagIds: [] }, /Enter a template name/],
    [{ name: "x".repeat(121), type: "custom", tagIds: [] }, /120/],
    [{ name: "x", type: null, tagIds: [] }, /Choose Custom code or Elementor/],
    [{ name: "x", type: "wordpress", tagIds: [] }, /Choose Custom code or Elementor/],
    [{ name: "x", type: "custom", tagIds: ["nope"] }, /Unknown tag/],
    [{ name: "x", type: "custom", tagIds: null }, /./],
    [{ name: "x", type: "custom", tagIds: [], notes: "n".repeat(5001) }, /5,000/],
    [{ name: "x", type: "custom", tagIds: [], usedIn: "u".repeat(2001) }, /2,000/],
  ])("rejects %j", (input, message) => {
    const result = templateDetailsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(message);
  });
});
