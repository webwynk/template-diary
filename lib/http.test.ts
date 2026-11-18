import { isSameOriginJson } from "@/lib/http";

const req = (headers: Record<string, string>) =>
  new Request("https://app.test/api/screenshot", { method: "POST", headers });

describe("isSameOriginJson", () => {
  it("accepts same-origin JSON and JSON without an Origin header", () => {
    expect(
      isSameOriginJson(req({ "content-type": "application/json", origin: "https://app.test" })),
    ).toBe(true);
    expect(isSameOriginJson(req({ "content-type": "application/json; charset=utf-8" }))).toBe(true);
  });

  it("refuses other origins and non-JSON bodies (what a cross-site form can send)", () => {
    expect(
      isSameOriginJson(req({ "content-type": "application/json", origin: "https://evil.test" })),
    ).toBe(false);
    expect(
      isSameOriginJson(req({ "content-type": "text/plain", origin: "https://app.test" })),
    ).toBe(false);
    expect(isSameOriginJson(req({}))).toBe(false);
    expect(isSameOriginJson(req({ "content-type": "application/json", origin: "null" }))).toBe(
      false,
    );
  });
});
