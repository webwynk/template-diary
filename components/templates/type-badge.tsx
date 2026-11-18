import { Badge } from "@/components/ui/badge";
import type { TemplateKind } from "@/lib/engine/types";

export const TYPE_LABELS: Record<TemplateKind, string> = {
  custom: "Custom",
  elementor: "Elementor",
};

/** DESIGN.md §2: Custom = sky, Elementor = pink. */
export function TypeBadge({ type }: { type: TemplateKind }) {
  return <Badge variant={type}>{TYPE_LABELS[type]}</Badge>;
}
