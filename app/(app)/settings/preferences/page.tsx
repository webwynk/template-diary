import { AlertCircle } from "lucide-react";

import { PreferencesForm } from "@/components/settings/preferences-form";
import { getPreferences } from "@/lib/db/settings";

export default async function PreferencesSettingsPage() {
  const result = await getPreferences();
  return (
    <section aria-labelledby="preferences-heading" className="space-y-6">
      <div>
        <h2 id="preferences-heading" className="text-xl font-semibold tracking-[-0.01em]">
          Preferences
        </h2>
        <p className="mt-1 text-muted-foreground">Defaults for the editor and new templates.</p>
      </div>
      {result.ok ? (
        <PreferencesForm
          key={`${result.data.defaultDevice}:${result.data.defaultFeatureMode}`}
          initial={result.data}
        />
      ) : (
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t load your preferences. Refresh the page to try again.
        </p>
      )}
    </section>
  );
}
