import { AlertCircle } from "lucide-react";

import { TagsManager } from "@/components/settings/tags-manager";
import { listTagsWithCounts } from "@/lib/db/tags";

export default async function TagsSettingsPage() {
  const tags = await listTagsWithCounts();

  return (
    <section aria-labelledby="tags-heading">
      <h2 id="tags-heading" className="text-xl font-semibold tracking-[-0.01em]">
        Tags
      </h2>
      <p className="mt-1 text-muted-foreground">
        Group your templates. A template can have several tags.
      </p>
      <div className="mt-6">
        {tags.ok ? (
          <TagsManager tags={tags.data} />
        ) : (
          <p role="alert" className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" aria-hidden />
            Couldn&apos;t load your tags. Refresh the page to try again.
          </p>
        )}
      </div>
    </section>
  );
}
