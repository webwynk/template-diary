"use client";

import { GitCompare } from "lucide-react";
import { useState } from "react";

import { CompareDialog, type CompareOption } from "@/components/templates/compare-dialog";
import { Button } from "@/components/ui/button";
import type { TemplateKind } from "@/lib/engine/types";

/** Opens the compare dialog: the Original against the newest variation by default. */
export function CompareButton({
  type,
  options,
}: {
  type: TemplateKind;
  /** Original first, then newest first (as in the variations list). */
  options: CompareOption[];
}) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <GitCompare aria-hidden />
        Compare
      </Button>
      {open ? (
        <CompareDialog
          open
          onOpenChange={setOpen}
          type={type}
          options={options}
          initialLeft={options[0]!.id}
          initialRight={options[1]!.id}
        />
      ) : null}
    </>
  );
}
