import { LibraryBrowser } from "@/components/library/library-browser";
import { parseFilters } from "@/lib/library/filters";

// Library (DESIGN.md §7.2): ?q=&type=&tag=&fav=1&sort=&view=list
export default async function LibraryPage({ searchParams }: PageProps<"/">) {
  return <LibraryBrowser filters={parseFilters(await searchParams)} base="/" />;
}
