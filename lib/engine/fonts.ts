// Font family helpers shared by the Custom and Elementor engines.

export const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "-apple-system",
  "blinkmacsystemfont",
]);

/** Font names we accept as swap targets: letters, digits, spaces and hyphens. */
export const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,59}$/;

export function isValidFontName(name: string): boolean {
  return FONT_NAME_RE.test(name.trim());
}

export interface GoogleFamily {
  family: string; // "Open Sans"
  raw: string; // "Open+Sans" exactly as in the URL
  offset: number; // index of raw inside the URL
}

/**
 * Families requested by a Google Fonts URL (css2: repeated family=…; css v1: family=A|B).
 * Returns [] for any other URL.
 */
export function googleFontFamilies(url: string): GoogleFamily[] {
  if (!/^(https?:)?\/\/fonts\.googleapis\.com\/css2?\?/i.test(url)) return [];
  const out: GoogleFamily[] = [];
  // "&amp;" appears when the URL is written inside an HTML attribute.
  const re = /(?:[?&]|&amp;)family=([^&]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(url))) {
    const valueStart = m.index + m[0].length - m[1]!.length;
    let pos = 0;
    for (const part of m[1]!.split("|")) {
      const nameRaw = part.split(":")[0]!;
      if (nameRaw) {
        out.push({
          family: decodeURIComponent(nameRaw.replace(/\+/g, " ")).trim(),
          raw: nameRaw,
          offset: valueStart + pos,
        });
      }
      pos += part.length + 1;
    }
  }
  return out;
}

/** How a family name is written in a Google Fonts URL. */
export function googleFamilyParam(name: string): string {
  return name.trim().replace(/ +/g, "+");
}

/**
 * Write `name` where `originalRaw` was, keeping its quote style. Names with spaces get quotes;
 * inside an HTML attribute we never use the attribute's own quote character.
 */
export function quoteFamily(name: string, originalRaw: string, attrQuote?: '"' | "'"): string {
  const first = originalRaw.charAt(0);
  const wasQuoted = first === '"' || first === "'";
  // Unquoted names must be CSS identifiers; quote anything with spaces or a word starting with a digit.
  const needsQuotes = /\s/.test(name) || /(^|\s)-?\d/.test(name);
  let quote: string | null = wasQuoted ? first : needsQuotes ? '"' : null;
  if (quote && attrQuote && quote === attrQuote) quote = attrQuote === '"' ? "'" : '"';
  return quote ? `${quote}${name}${quote}` : name;
}
