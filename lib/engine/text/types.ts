// Text tab model (DEVELOPMENT.md §7 "Text tab"). Pure data, no I/O.

/**
 * text: plain text (entities decoded, whitespace collapsed for display).
 * html: text with inline tags (bold, links…), shown and written as HTML.
 * link: a link's URL. icon: an icon element (font icon classes, inline SVG, image, ligature).
 */
export type TextFieldType = "text" | "html" | "link" | "icon";

export type TextRole =
  "eyebrow" | "title" | "heading" | "subheading" | "text" | "button" | "link" | "icon" | "item";

/** What an icon field currently is. */
export type IconKind = "font" | "svg" | "image" | "ligature";

export interface TextField {
  /** Structural key, stable while the element's position in the tree is unchanged. */
  key: string;
  role: TextRole;
  /** Guessed name, e.g. "Title", "Button link", "Item 2". */
  label: string;
  type: TextFieldType;
  /**
   * The value a TextSwap's `from` must equal: display text (text), source HTML (html), decoded
   * URL (link), or the icon element's source (icon).
   */
  value: string;
  iconKind?: IconKind;
  /** Icon fields: the classes (font), image URL (image) or ligature name; for showing only. */
  iconValue?: string;
  /** Where the value sits in the source (Custom: character range; Elementor: JSON path). */
  location:
    | { kind: "range"; start: number; end: number; line: number }
    | { kind: "path"; path: (string | number)[] };
}

export interface TextGroup {
  /** Structural key of the group (a card's element, or a run of fields in a section). */
  key: string;
  kind: "heading" | "content" | "card" | "section";
  label: string;
  fields: TextField[];
}

export interface TextModel {
  groups: TextGroup[];
  warnings: string[];
}
