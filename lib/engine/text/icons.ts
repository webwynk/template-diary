// Recognizing icon classes (Font Awesome, Bootstrap Icons, Remix, Line Awesome, Material…).

const ICON_TOKEN_RE = new RegExp(
  "^(?:" +
    [
      "fa|fas|far|fal|fat|fad|fab|fass|fasr|fasl|fast|fadr",
      "fa-(?:solid|regular|light|thin|duotone|brands|sharp|sharp-duotone|classic)",
      "fa-[a-z0-9-]+",
      "bi|bi-[a-z0-9-]+",
      "ri-[a-z0-9-]+",
      "la|las|lar|lab|la-[a-z0-9-]+",
      "ti|ti-[a-z0-9-]+",
      "icofont-[a-z0-9-]+",
      "eicon-[a-z0-9-]+",
      "dashicons|dashicons-[a-z0-9-]+",
      "glyphicon|glyphicon-[a-z0-9-]+",
      "material-icons(?:-[a-z]+)?",
      "material-symbols(?:-[a-z]+)?",
      "icon-[a-z0-9-]+",
      "feather|feather-[a-z0-9-]+",
      "lni|lni-[a-z0-9-]+",
      "ion-[a-z0-9-]+|ion|ionicons",
      "mdi|mdi-[a-z0-9-]+",
      "uil|uil-[a-z0-9-]+",
      "bx|bxs|bxl|bx-[a-z0-9-]+|bxs-[a-z0-9-]+|bxl-[a-z0-9-]+",
    ].join("|") +
    ")$",
  "i",
);

/** Font Awesome size/animation helpers: kept when the icon itself is replaced. */
const FA_MODIFIER_RE =
  /^fa-(?:xs|sm|lg|xl|2xs|2xl|[1-9]x|10x|fw|spin|spin-pulse|spin-reverse|pulse|border|pull-left|pull-right|pull-start|pull-end|inverse|beat|beat-fade|bounce|fade|flip|shake|li|ul|stack|stack-1x|stack-2x|flip-horizontal|flip-vertical|flip-both|rotate-90|rotate-180|rotate-270|rotate-by|swap-opacity)$/i;

const LIGATURE_RE = /^material-(?:icons|symbols)(?:-[a-z]+)?$/i;

export function classTokens(value: string | undefined): string[] {
  return (value ?? "").split(/\s+/).filter(Boolean);
}

/** A class token that names an icon or an icon set (not a size/animation modifier). */
export function isIconToken(token: string): boolean {
  return ICON_TOKEN_RE.test(token) && !FA_MODIFIER_RE.test(token);
}

export function hasIconClass(tokens: string[]): boolean {
  return tokens.some(isIconToken);
}

/** Material Icons / Symbols: the icon is named by the element's text (a ligature). */
export function isLigatureIcon(tokens: string[]): boolean {
  return tokens.some((t) => LIGATURE_RE.test(t));
}

/** Classes that stay when an icon is replaced: everything that isn't an icon token. */
export function keptClasses(tokens: string[]): string[] {
  return tokens.filter((t) => !isIconToken(t));
}

/** The icon tokens of a class list, for showing in the Text tab ("fa-solid fa-star"). */
export function iconClasses(tokens: string[]): string {
  return tokens.filter(isIconToken).join(" ");
}

/** Allowed icon class input: letters, digits, "-" and "_", separated by spaces. */
export const ICON_CLASSES_RE = /^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/;
