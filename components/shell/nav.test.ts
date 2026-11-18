import { isActive, titleFor } from "@/components/shell/nav";

describe("isActive", () => {
  it("matches Library only on the root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/favorites", "/")).toBe(false);
  });

  it("matches nested paths but not lookalike prefixes", () => {
    expect(isActive("/settings/tags", "/settings")).toBe(true);
    expect(isActive("/settingsx", "/settings")).toBe(false);
  });
});

describe("titleFor", () => {
  it.each([
    ["/", "Library"],
    ["/favorites", "Favorites"],
    ["/settings/account", "Settings"],
    ["/templates/new", "New template"],
    ["/templates/123", "Template"],
  ])("%s → %s", (path, title) => {
    expect(titleFor(path)).toBe(title);
  });
});
