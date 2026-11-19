// @vitest-environment node
import { setTextLabelAction } from "@/actions/text-labels";

const setTextLabel = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u", email: "e" })) }));
vi.mock("@/lib/db/text-labels", () => ({
  setTextLabel: (...a: unknown[]) => setTextLabel(...a),
}));

const ID = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";

beforeEach(() => setTextLabel.mockReset().mockResolvedValue({ ok: true, data: null }));

describe("setTextLabelAction", () => {
  it("trims the name and saves it", async () => {
    expect(
      await setTextLabelAction(ID, { kind: "field", key: "h1[0]|text", label: "  Big title " }),
    ).toEqual({ ok: true, label: "Big title" });
    expect(setTextLabel).toHaveBeenCalledWith(ID, {
      kind: "field",
      key: "h1[0]|text",
      label: "Big title",
    });
  });

  it("refuses bad ids, kinds, keys and long names before the database", async () => {
    expect(await setTextLabelAction("nope", { kind: "field", key: "k", label: "x" })).toEqual({
      ok: false,
      error: "This template no longer exists.",
    });
    expect(await setTextLabelAction(ID, { kind: "card", key: "k", label: "x" })).toMatchObject({
      ok: false,
    });
    expect(await setTextLabelAction(ID, { kind: "field", key: "", label: "x" })).toMatchObject({
      ok: false,
    });
    expect(
      await setTextLabelAction(ID, { kind: "field", key: "k", label: "x".repeat(61) }),
    ).toEqual({ ok: false, error: "Names can be at most 60 characters." });
    expect(setTextLabel).not.toHaveBeenCalled();
  });

  it("passes database errors through", async () => {
    setTextLabel.mockResolvedValue({ ok: false, error: "This template no longer exists." });
    expect(await setTextLabelAction(ID, { kind: "group", key: "g", label: "" })).toEqual({
      ok: false,
      error: "This template no longer exists.",
    });
  });
});
