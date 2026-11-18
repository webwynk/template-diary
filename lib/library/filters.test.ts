import { filtersHref, hasActiveFilters, parseFilters } from "@/lib/library/filters";

const TAG = "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f";

describe("library filters", () => {
  it("reads the URL and falls back to defaults for anything unknown", () => {
    expect(parseFilters({})).toEqual({
      q: "",
      type: null,
      tag: null,
      fav: false,
      sort: "updated",
      view: "grid",
    });
    expect(
      parseFilters({
        q: "  hero ",
        type: "elementor",
        tag: TAG,
        fav: "1",
        sort: "name",
        view: "list",
      }),
    ).toEqual({ q: "hero", type: "elementor", tag: TAG, fav: true, sort: "name", view: "list" });
    expect(
      parseFilters({ type: "x", tag: "nope", fav: "yes", sort: "drop", q: ["a", "b"] }),
    ).toEqual(parseFilters({}));
    expect(parseFilters({ q: "x".repeat(300) }).q).toHaveLength(200);
  });

  it("builds short URLs that round-trip", () => {
    const f = parseFilters({ q: "50% off", type: "custom", tag: TAG, fav: "1", sort: "created" });
    const href = filtersHref(f);
    expect(href).toBe(`/?q=50%25+off&type=custom&tag=${TAG}&fav=1&sort=created`);
    expect(parseFilters(Object.fromEntries(new URL(href, "http://x").searchParams))).toEqual(f);
    expect(filtersHref(f, { q: "", type: null, tag: null, fav: false, sort: "updated" })).toBe("/");
    expect(filtersHref(parseFilters({}), { view: "list" })).toBe("/?view=list");
  });

  it("never adds fav on the Favorites page", () => {
    expect(filtersHref(parseFilters({ fav: "1", q: "a" }), {}, "/favorites")).toBe(
      "/favorites?q=a",
    );
    expect(filtersHref(parseFilters({}), {}, "/favorites")).toBe("/favorites");
  });

  it("knows when filters are active (sort and view don't count)", () => {
    expect(hasActiveFilters(parseFilters({ sort: "name", view: "list" }))).toBe(false);
    expect(hasActiveFilters(parseFilters({ fav: "1" }))).toBe(true);
    expect(hasActiveFilters(parseFilters({ q: "a" }))).toBe(true);
  });
});
