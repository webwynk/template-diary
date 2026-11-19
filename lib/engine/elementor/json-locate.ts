// Find the exact text range of every primitive value in a JSON document, by path.
//
// Elementor swaps are written back into the original text at these ranges instead of
// re-serializing the whole object, so every byte we don't swap stays identical (key order,
// spacing, "\/" escapes and number formatting included). The input must already be valid JSON
// (it is checked with JSON.parse first).

export type JsonPath = (string | number)[];

export interface TokenRange {
  start: number;
  end: number;
}

/** Map key: JSON.stringify(path). */
export type TokenMap = Map<string, TokenRange>;

export function pathKey(path: JsonPath): string {
  return JSON.stringify(path);
}

export function locateTokens(text: string): TokenMap {
  const map: TokenMap = new Map();
  let i = 0;

  const ws = () => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };

  const stringEnd = (from: number): number => {
    let j = from + 1;
    while (j < text.length) {
      const c = text[j];
      if (c === "\\") j += 2;
      else if (c === '"') return j + 1;
      else j++;
    }
    throw new SyntaxError("Unterminated string");
  };

  const value = (path: JsonPath): void => {
    ws();
    const from = i;
    container(path);
    // Objects and arrays are recorded too (whole-value replacements, e.g. an Elementor icon).
    if (text[from] === "{" || text[from] === "[") map.set(pathKey(path), { start: from, end: i });
  };

  const container = (path: JsonPath): void => {
    const c = text[i];
    if (c === "{") {
      i++;
      ws();
      if (text[i] === "}") {
        i++;
        return;
      }
      for (;;) {
        ws();
        const keyStart = i;
        i = stringEnd(i);
        const key = JSON.parse(text.slice(keyStart, i)) as string;
        ws();
        i++; // ':'
        value([...path, key]);
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        i++; // '}'
        return;
      }
    }
    if (c === "[") {
      i++;
      ws();
      if (text[i] === "]") {
        i++;
        return;
      }
      for (let index = 0; ; index++) {
        value([...path, index]);
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        i++; // ']'
        return;
      }
    }
    const start = i;
    if (c === '"') {
      i = stringEnd(i);
    } else {
      while (i < text.length && !/[\s,\]}]/.test(text[i]!)) i++;
    }
    // Duplicate keys: JSON.parse keeps the last one, and so do we.
    map.set(pathKey(path), { start, end: i });
  };

  value([]);
  return map;
}

/**
 * Encode a string as a JSON token in the same style as `originalToken`: keep "\/" escaping if
 * the original used it, and escape non-ASCII so the result is safe in any encoding.
 */
export function encodeJsonString(value: string, originalToken: string): string {
  let out = JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  if (originalToken.includes("\\/")) out = out.replace(/\//g, "\\/");
  return out;
}
