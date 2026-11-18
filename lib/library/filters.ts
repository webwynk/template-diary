// Library filters (DESIGN.md §7.2): URL-driven ?q=&type=&tag=&fav=1&sort=&view=list.
import { z } from "zod";

export type LibrarySort = "updated" | "created" | "name";
export type LibraryView = "grid" | "list";

export interface LibraryFilters {
  q: string;
  type: "custom" | "elementor" | null;
  tag: string | null;
  fav: boolean;
  sort: LibrarySort;
  view: LibraryView;
}

export const SORT_LABELS: Record<LibrarySort, string> = {
  updated: "Last edited",
  created: "Newest",
  name: "Name A–Z",
};

const uuid = z.uuid();
type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
}

/** Reads the URL; anything unknown or malformed falls back to the default. */
export function parseFilters(params: Params): LibraryFilters {
  const type = one(params, "type");
  const tag = one(params, "tag");
  const sort = one(params, "sort");
  return {
    q: (one(params, "q") ?? "").trim().slice(0, 200),
    type: type === "custom" || type === "elementor" ? type : null,
    tag: tag && uuid.safeParse(tag).success ? tag : null,
    fav: one(params, "fav") === "1",
    sort: sort === "created" || sort === "name" ? sort : "updated",
    view: one(params, "view") === "list" ? "list" : "grid",
  };
}

/**
 * The URL for these filters (defaults are left out so links stay short). On /favorites the
 * favorites filter is the page itself, so it is never added there.
 */
export function filtersHref(
  f: LibraryFilters,
  patch: Partial<LibraryFilters> = {},
  base: "/" | "/favorites" = "/",
): string {
  const next = { ...f, ...patch };
  const q = new URLSearchParams();
  if (next.q) q.set("q", next.q);
  if (next.type) q.set("type", next.type);
  if (next.tag) q.set("tag", next.tag);
  if (next.fav && base === "/") q.set("fav", "1");
  if (next.sort !== "updated") q.set("sort", next.sort);
  if (next.view === "list") q.set("view", "list");
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function hasActiveFilters(f: LibraryFilters): boolean {
  return Boolean(f.q || f.type || f.tag || f.fav);
}
