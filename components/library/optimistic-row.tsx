"use client";

import { useTemplateOverride } from "@/lib/library/optimistic";

/** A library card (li) or list row (tr) that disappears the moment it's moved to the trash. */
export function OptimisticItem({
  id,
  as: Tag,
  className,
  children,
}: {
  id: string;
  as: "li" | "tr";
  className?: string;
  children: React.ReactNode;
}) {
  const override = useTemplateOverride(id);
  if (override?.trashed) return null;
  return <Tag className={className}>{children}</Tag>;
}
