"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getVariationContentAction } from "@/actions/templates";
import { Button } from "@/components/ui/button";

type Size = "sm" | "md";

/**
 * Copies a variation's exact saved content (DESIGN.md §9: check + "Copied" for 1.5 s).
 * The content is fetched on click, so list pages never load it. Safari only allows clipboard
 * writes during the click, so the fetch is handed to ClipboardItem as a promise when possible.
 */
export function CopyCodeButton({
  variationId,
  label = "Copy code",
  size = "sm",
  variant = "secondary",
}: {
  variationId: string;
  label?: string;
  size?: Size;
  variant?: "secondary" | "primary";
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");

  async function fetchContent(): Promise<string> {
    const result = await getVariationContentAction(variationId);
    if (!result.ok) throw new Error(result.error);
    return result.content;
  }

  async function copy() {
    setState("copying");
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = fetchContent().then((text) => new Blob([text], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      } else {
        await navigator.clipboard.writeText(await fetchContent());
      }
      setState("copied");
      setTimeout(() => setState("idle"), 1500);
    } catch (error) {
      setState("idle");
      toast.error(
        error instanceof Error && error.message ? error.message : "Couldn't copy. Try again.",
      );
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => void copy()}
      disabled={state === "copying"}
    >
      {state === "copying" ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : state === "copied" ? (
        <Check className="text-success" aria-hidden />
      ) : (
        <Copy aria-hidden />
      )}
      <span aria-live="polite">{state === "copied" ? "Copied" : label}</span>
    </Button>
  );
}
