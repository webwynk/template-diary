"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { savePreferencesAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import type { Preferences } from "@/lib/validation/settings";

const DEVICES = [
  { value: 1440, label: "Desktop", hint: "1440 px" },
  { value: 768, label: "Tablet", hint: "768 px" },
  { value: 375, label: "Mobile", hint: "375 px" },
] as const;

const MODES = [
  { value: "auto", label: "Create from the desktop preview" },
  { value: "upload", label: "Upload my own image" },
] as const;

/** Settings → Preferences (DESIGN.md §7.8). */
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();
  const changed =
    prefs.defaultDevice !== initial.defaultDevice ||
    prefs.defaultFeatureMode !== initial.defaultFeatureMode;

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const r = await savePreferencesAction(prefs);
        if (r.ok) toast.success("Preferences saved");
        else toast.error(r.error);
      } catch {
        toast.error("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Preview device</legend>
        <p className="text-[13px] text-muted-foreground">
          The width the editor preview starts at on a computer. On a phone it always starts at
          Mobile.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEVICES.map((d) => (
            <label
              key={d.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="default-device"
                value={d.value}
                checked={prefs.defaultDevice === d.value}
                onChange={() => setPrefs((p) => ({ ...p, defaultDevice: d.value }))}
                disabled={pending}
                className="size-4 accent-primary"
              />
              <span className="font-medium">{d.label}</span>
              <span className="text-muted-foreground">{d.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Feature image for new Custom templates</legend>
        <p className="text-[13px] text-muted-foreground">
          Which option is picked first when you create a template. You can still change it there.
        </p>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="default-feature-mode"
                value={m.value}
                checked={prefs.defaultFeatureMode === m.value}
                onChange={() => setPrefs((p) => ({ ...p, defaultFeatureMode: m.value }))}
                disabled={pending}
                className="size-4 accent-primary"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending || !changed}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save preferences
      </Button>
    </form>
  );
}
