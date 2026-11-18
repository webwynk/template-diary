// The 10 tag colors offered in Settings → Tags (DESIGN.md §7.8). Tag colors are only used
// for the small dot next to a tag's name. The first one matches the database default.
export const TAG_COLORS = [
  { name: "Slate", hex: "#64748B" },
  { name: "Red", hex: "#DC2626" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Amber", hex: "#D97706" },
  { name: "Green", hex: "#16A34A" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Sky", hex: "#0284C7" },
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Violet", hex: "#7C3AED" },
  { name: "Pink", hex: "#DB2777" },
] as const;

export type TagColorHex = (typeof TAG_COLORS)[number]["hex"];

export const DEFAULT_TAG_COLOR: TagColorHex = "#64748B";

export type TagWithCount = {
  id: string;
  name: string;
  color: string;
  templateCount: number;
};
