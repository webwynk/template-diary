// Small helpers for positions inside a source text.

/** Offsets where each line starts, for turning an offset into a 1-based line number. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

export function lineAt(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** About 40 characters around [start, end) on one line, for showing where a match is. */
export function snippetAt(text: string, start: number, end: number, radius = 20): string {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const body = text.slice(from, to).replace(/\s+/g, " ").trim();
  return `${from > 0 ? "…" : ""}${body}${to < text.length ? "…" : ""}`;
}
