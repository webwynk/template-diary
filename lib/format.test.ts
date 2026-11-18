import { initials, plural, relativeTime, shortDate } from "@/lib/format";

const now = new Date("2026-11-18T12:00:00Z");

describe("format helpers", () => {
  it("formats relative times", () => {
    expect(relativeTime("2026-11-18T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-11-18T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-11-18T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-11-16T12:00:00Z", now)).toBe("2d ago");
    expect(relativeTime("2026-10-12T12:00:00Z", now)).toBe("12 Oct");
    expect(relativeTime("not a date", now)).toBe("");
    expect(shortDate("2025-10-12T12:00:00Z", now)).toBe("12 Oct 2025");
  });

  it("pluralizes and builds initials", () => {
    expect(plural(1, "variation")).toBe("1 variation");
    expect(plural(4, "variation")).toBe("4 variations");
    expect(initials("hero dark section")).toBe("HD");
    expect(initials("  ")).toBe("?");
  });
});
