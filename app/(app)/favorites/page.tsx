import { LibraryBrowser } from "@/components/library/library-browser";
import { parseFilters } from "@/lib/library/filters";

// Favorites: the library with the favorites filter fixed on (DESIGN.md §6).
export default async function FavoritesPage({ searchParams }: PageProps<"/favorites">) {
  return <LibraryBrowser filters={parseFilters(await searchParams)} base="/favorites" />;
}
