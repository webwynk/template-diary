import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplateEditor } from "@/components/editor/template-editor";
import { getEditorData } from "@/lib/db/templates";
import { idSchema } from "@/lib/validation/templates";

export const metadata: Metadata = { title: "Editor · Template Diary" };

// Editor (DESIGN.md §7.5). ?base=<variationId> picks the starting variation (default: Original).
export default async function EditPage({
  params,
  searchParams,
}: PageProps<"/templates/[id]/edit">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const baseParam = typeof query.base === "string" ? query.base : undefined;
  if (!idSchema.safeParse(id).success) notFound();
  if (baseParam !== undefined && !idSchema.safeParse(baseParam).success) notFound();

  const result = await getEditorData(id, baseParam);
  if (!result.ok) {
    return (
      <p role="alert" className="flex h-dvh items-center justify-center gap-2 text-destructive">
        <AlertCircle className="size-4" aria-hidden />
        Couldn&apos;t load this template. Refresh the page to try again.
      </p>
    );
  }
  if (!result.data) notFound();

  // Keyed by the base so switching (or saving a new variation) starts a fresh session.
  return <TemplateEditor key={result.data.base.id} data={result.data} />;
}
