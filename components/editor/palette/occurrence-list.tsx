"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Location } from "@/lib/engine/types";

export interface OccurrenceItem {
  id: string;
  location: Location;
  snippet: string;
  /** Text inside the snippet to highlight. */
  highlight: string;
  /** Extra label, e.g. "srcset" or "Google Fonts link". */
  label?: string;
}

/**
 * Occurrences of one detected value (DESIGN.md §7.5): line + snippet, a checkbox to leave an
 * occurrence unchanged (only when a new value is set), and a click to jump to it in the code.
 */
export function OccurrenceList({
  items,
  excluded,
  onToggle,
  onJump,
}: {
  items: OccurrenceItem[];
  /** Ids left unchanged; undefined when the row has no new value (no checkboxes then). */
  excluded: string[] | undefined;
  onToggle: (id: string) => void;
  onJump?: (location: Location) => void;
}) {
  return (
    <ul className="space-y-0.5 border-t border-border bg-surface px-2 py-1.5">
      {items.map((item) => {
        const line = item.location.kind === "range" ? item.location.line : null;
        const checked = excluded ? !excluded.includes(item.id) : undefined;
        return (
          <li key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1">
            {checked !== undefined ? (
              <Checkbox
                className="mt-0.5 bg-background"
                checked={checked}
                onCheckedChange={() => onToggle(item.id)}
                aria-label={`${checked ? "Leave unchanged" : "Change"}: ${line ? `line ${line}` : item.snippet}`}
              />
            ) : null}
            <button
              type="button"
              disabled={!onJump || line === null}
              onClick={() => onJump?.(item.location)}
              className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
              title={line !== null && onJump ? `Show line ${line} in the code` : undefined}
            >
              <span className="flex items-baseline gap-2">
                {line !== null ? (
                  <span className="w-9 shrink-0 font-mono text-[11px] text-subtle-foreground tabular-nums">
                    L{line}
                  </span>
                ) : null}
                <Snippet text={item.snippet} highlight={item.highlight} />
              </span>
              {item.label ? (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.label}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Snippet({ text, highlight }: { text: string; highlight: string }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  const cls = "min-w-0 break-all font-mono text-[11px] text-foreground/80";
  if (at < 0) return <span className={cls}>{text}</span>;
  return (
    <span className={cls}>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-primary-soft px-0.5 text-primary">{highlight}</mark>
      {text.slice(at + highlight.length)}
    </span>
  );
}
