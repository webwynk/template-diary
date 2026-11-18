import { Heart, Library, Palette, Settings, Trash2, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// DESIGN.md §6: main navigation, in sidebar order.
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Library", icon: Library },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/palettes", label: "Palettes", icon: Palette },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** Is `href` the active nav item for `pathname`? "/" only matches the library itself. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/favorites", title: "Favorites" },
  { prefix: "/palettes", title: "Palettes" },
  { prefix: "/trash", title: "Trash" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/templates/new", title: "New template" },
];

/** Page title shown in the top bar. */
export function titleFor(pathname: string): string {
  return TITLES.find((t) => isActive(pathname, t.prefix))?.title ?? "Library";
}
