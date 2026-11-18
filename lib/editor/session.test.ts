import { detect } from "@/lib/engine";
import {
  activeSwaps,
  changeMarks,
  normalizeHex,
  computeOutput,
  editorReducer,
  initialState,
  summarizeChanges,
} from "@/lib/editor/session";

const HTML = `<style>.a{color:#4f46e5}.b{background:#4F46E5;font-family:"Open Sans"}</style><img src="https://x.test/a.jpg"><script>var c="#4f46e5"</script>`;

function run(state = initialState(HTML)) {
  const detection = detect(state.source, "custom");
  return { detection, swaps: activeSwaps(state.pending, detection) };
}

describe("editor session", () => {
  it("applies pending swaps on top of the source and resets per row and all", () => {
    let s = initialState(HTML);
    s = editorReducer(s, { type: "setTarget", kind: "color", from: "#4F46E5", to: "#10b981" });
    s = editorReducer(s, {
      type: "setTarget",
      kind: "image",
      from: "https://x.test/a.jpg",
      to: "https://y.test/b.jpg",
    });
    s = editorReducer(s, { type: "setTarget", kind: "font", from: "Open Sans", to: "Inter" });
    const { swaps } = run(s);
    expect(swaps).toHaveLength(3);
    const out = computeOutput(s.source, "custom", swaps);
    expect(out.ok && out.content).toBe(
      `<style>.a{color:#10b981}.b{background:#10B981;font-family:"Inter"}</style><img src="https://y.test/b.jpg"><script>var c="#4f46e5"</script>`,
    );
    expect(s.source).toBe(HTML); // the source itself never changes from palette actions

    s = editorReducer(s, { type: "resetRow", kind: "image", from: "https://x.test/a.jpg" });
    expect(run(s).swaps.map((x) => x.kind)).toEqual(["color", "font"]);
    expect(editorReducer(s, { type: "resetRow", kind: "image", from: "nope" })).toBe(s);

    s = editorReducer(s, { type: "setSource", source: `${HTML}\n<p>edited</p>` });
    s = editorReducer(s, { type: "resetAll" });
    expect(s).toEqual(initialState(HTML));
  });

  it("unticks single occurrences and clears unticks when the code is edited", () => {
    let s = initialState(HTML);
    s = editorReducer(s, { type: "setTarget", kind: "color", from: "#4f46e5", to: "#000000" });
    const first = run(s).detection.colors[0]?.occurrences[0]?.id ?? "";
    s = editorReducer(s, { type: "toggleExclude", kind: "color", from: "#4f46e5", id: first });
    const out = computeOutput(s.source, "custom", run(s).swaps);
    expect(out.ok && out.content).toContain(".a{color:#4f46e5}.b{background:#000000");
    // Toggle back on, then off again, then edit the code: unticks are cleared (ids are offsets).
    s = editorReducer(s, { type: "toggleExclude", kind: "color", from: "#4f46e5", id: first });
    expect(s.pending.color["#4f46e5"]?.excludeIds).toEqual([]);
    s = editorReducer(s, { type: "toggleExclude", kind: "color", from: "#4f46e5", id: first });
    s = editorReducer(s, { type: "setSource", source: ` ${HTML}` });
    expect(s.pending.color["#4f46e5"]).toEqual({ from: "#4f46e5", to: "#000000", excludeIds: [] });
    expect(editorReducer(s, { type: "setSource", source: s.source })).toBe(s);
    expect(editorReducer(s, { type: "toggleExclude", kind: "font", from: "x", id: "y" })).toBe(s);
  });

  it("keeps pending swaps that still match after edits and ignores the rest", () => {
    let s = initialState(HTML);
    s = editorReducer(s, { type: "setTarget", kind: "color", from: "#4f46e5", to: "#000000" });
    s = editorReducer(s, { type: "setTarget", kind: "color", from: "#123456", to: "#000000" });
    s = editorReducer(s, { type: "setSource", source: "<style>.z{color:#4f46e5}</style>" });
    const { swaps } = run(s);
    expect(swaps).toEqual([{ kind: "color", fromRgb: "#4f46e5", to: "#000000", excludeIds: [] }]);
  });

  it("reports engine errors instead of throwing", () => {
    const out = computeOutput(HTML, "custom", [
      { kind: "image", fromUrl: "https://x.test/a.jpg", to: "javascript:x" },
    ]);
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/http/) });
    expect(computeOutput("{}", "elementor", []).ok).toBe(false);
  });

  it("summarizes changes", () => {
    const c = (kind: "color" | "image" | "font") => ({ kind, from: "a", to: "b", count: 1 });
    expect(summarizeChanges([c("color"), c("color"), c("image"), c("font")], false)).toBe(
      "2 colors, 1 image and 1 font changed",
    );
    expect(summarizeChanges([c("font")], true)).toBe("1 font changed, code edited");
    expect(summarizeChanges([], true)).toBe("Code edited");
    expect(summarizeChanges([], false)).toBe("");
  });

  it("marks the ranges a swap changes, skipping excluded occurrences", () => {
    let s = initialState(HTML);
    s = editorReducer(s, { type: "setTarget", kind: "color", from: "#4f46e5", to: "#10b981" });
    s = editorReducer(s, {
      type: "setTarget",
      kind: "image",
      from: "https://x.test/a.jpg",
      to: "https://y.test/photos/b.jpg?w=2",
    });
    s = editorReducer(s, { type: "setTarget", kind: "font", from: "open sans", to: "Inter" });
    const { detection, swaps } = run(s);
    const marks = changeMarks(detection, swaps);
    expect(marks.map((m) => [HTML.slice(m.start, m.end), m.after])).toEqual([
      ["#4f46e5", "→ #10b981"],
      ["#4F46E5", "→ #10b981"],
      ['"Open Sans"', "→ Inter"],
      ["https://x.test/a.jpg", "→ b.jpg"],
    ]);

    const second = detection.colors[0]!.occurrences[1]!.id;
    s = editorReducer(s, { type: "toggleExclude", kind: "color", from: "#4f46e5", id: second });
    const after = changeMarks(detection, activeSwaps(s.pending, detection));
    expect(after.map((m) => HTML.slice(m.start, m.end))).toEqual([
      "#4f46e5",
      '"Open Sans"',
      "https://x.test/a.jpg",
    ]);
    expect(changeMarks(detection, [])).toEqual([]);
  });

  it("normalizes picker hex values to what the engine accepts", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("abcd")).toBe("#aabbccdd");
    expect(normalizeHex("#4F46E5")).toBe("#4f46e5");
    expect(normalizeHex("#4f46e580")).toBe("#4f46e580");
    expect(normalizeHex("#4f46e5ff")).toBe("#4f46e5");
    expect(normalizeHex("#4f46e")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
  });
});

describe("setColors (Apply preset)", () => {
  it("replaces the color rows only, and undoing restores them exactly", () => {
    let s = initialState(HTML);
    s = editorReducer(s, { type: "setTarget", kind: "font", from: "Open Sans", to: "Inter" });
    const before = s.pending.color;
    const mapped = { "#4f46e5": { from: "#4f46e5", to: "#ef4444", excludeIds: [] } };
    s = editorReducer(s, { type: "setColors", color: mapped });
    expect(s.pending.color).toBe(mapped);
    expect(s.pending.font["open sans"]?.to).toBe("Inter");
    const out = computeOutput(s.source, "custom", run(s).swaps);
    expect(out.ok && out.content).toContain(".a{color:#ef4444}");
    s = editorReducer(s, { type: "setColors", color: before });
    expect(s.pending.color).toEqual({});
    expect(editorReducer(s, { type: "setColors", color: s.pending.color })).toBe(s);
  });
});
