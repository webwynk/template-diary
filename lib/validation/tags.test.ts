import { createTagSchema, updateTagSchema } from "@/lib/validation/tags";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("tag validation", () => {
  it("trims names and accepts preset colors", () => {
    expect(createTagSchema.parse({ name: "  Hero  ", color: "#4F46E5" })).toEqual({
      name: "Hero",
      color: "#4F46E5",
    });
  });

  it("rejects empty, too-long names and non-preset colors", () => {
    expect(createTagSchema.safeParse({ name: "   ", color: "#4F46E5" }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: "x".repeat(41), color: "#4F46E5" }).success).toBe(
      false,
    );
    expect(createTagSchema.safeParse({ name: "Hero", color: "#123456" }).success).toBe(false);
  });

  it("requires a valid id and at least one field to update", () => {
    expect(updateTagSchema.safeParse({ id: ID }).success).toBe(false);
    expect(updateTagSchema.safeParse({ id: "nope", name: "x" }).success).toBe(false);
    expect(updateTagSchema.safeParse({ id: ID, color: "#DC2626" }).success).toBe(true);
  });
});
