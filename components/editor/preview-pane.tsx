"use client";

import { AlertCircle, LayoutTemplate, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEVICES, type DeviceId } from "@/components/editor/devices";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TemplateKind } from "@/lib/engine/types";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { buildSrcdoc, parsePreviewMessage } from "@/lib/preview/build-srcdoc";
import { cn } from "@/lib/utils";

const MAX_ERRORS = 50;

/** Live preview (DESIGN.md §7.5): sandboxed iframe at the real device width, scaled to fit. */
export function PreviewPane({
  type,
  content,
  device,
  onDeviceChange,
  imageUrl,
}: {
  type: TemplateKind;
  /** The content to preview, or null when it can't be computed (the code pane shows why). */
  content: string | null;
  device: DeviceId;
  onDeviceChange: (device: DeviceId) => void;
  /** Elementor: the feature image shown instead of a live render. */
  imageUrl?: string | null;
}) {
  const [reloads, setReloads] = useState(0);
  return (
    <section aria-label="Preview" className="flex h-full min-w-0 flex-col bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Preview
        </h2>
        {type === "custom" ? (
          <>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
              Live
            </span>
            <div className="ml-auto flex items-center gap-1">
              <DeviceSwitch value={device} onChange={onDeviceChange} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Reload preview"
                    onClick={() => setReloads((n) => n + 1)}
                  >
                    <RotateCw aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reload preview</TooltipContent>
              </Tooltip>
            </div>
          </>
        ) : null}
      </div>
      {type === "custom" ? (
        <PreviewCanvas key={reloads} content={content} device={device} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-6 text-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
            <img
              src={imageUrl}
              alt="Feature image"
              className="w-full max-w-[720px] rounded-lg border border-border bg-background object-cover object-top shadow-sm"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-xs">
              <LayoutTemplate className="size-5 text-muted-foreground" aria-hidden />
            </span>
          )}
          <p className="max-w-[320px] text-[13px] text-muted-foreground">
            Elementor templates can&apos;t be rendered live. Swaps are applied to the JSON.
          </p>
        </div>
      )}
    </section>
  );
}

function DeviceSwitch({
  value,
  onChange,
}: {
  value: DeviceId;
  onChange: (device: DeviceId) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Preview width"
      className="flex rounded-lg bg-surface-2 p-0.5"
    >
      {DEVICES.map((d, i) => (
        <Tooltip key={d.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={value === d.id}
              aria-label={`${d.label} ${d.width}px`}
              onClick={() => onChange(d.id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground tabular-nums transition-colors hover:text-foreground",
                value === d.id && "bg-background text-foreground shadow-xs",
              )}
            >
              <d.icon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{d.width}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {d.label} · {d.width}px · key {i + 1}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function PreviewCanvas({ content, device }: { content: string | null; device: DeviceId }) {
  const width = DEVICES.find((d) => d.id === device)!.width;
  const canvasRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  // Live updates are debounced (RULES.md §5); the iframe reloads only when the text changes.
  const debounced = useDebounced(content, 300);
  const srcdoc = useMemo(() => (debounced === null ? null : buildSrcdoc(debounced)), [debounced]);
  const [shownSrcdoc, setShownSrcdoc] = useState(srcdoc);
  if (srcdoc !== shownSrcdoc) {
    setShownSrcdoc(srcdoc);
    setErrors([]);
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only our own iframe may talk to us (RULES.md §7); its origin is opaque ("null").
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const message = parsePreviewMessage(event.data);
      if (message?.type === "error") {
        setErrors((list) => (list.length >= MAX_ERRORS ? list : [...list, message.message]));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Never scale above 100% (DESIGN.md §7.5). The frame fills the pane's height at that scale and
  // scrolls inside, like a real browser window, so `100vh` sections behave as on a real screen.
  const scale = box.width > 0 ? Math.min(1, box.width / width) : 1;
  const frameHeight = box.height > 0 ? Math.floor(box.height / scale) : 800;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
      <div ref={canvasRef} className="relative min-h-0 flex-1">
        {shownSrcdoc !== null && box.width > 0 ? (
          <div
            className={cn(
              "absolute top-0 left-1/2 -translate-x-1/2 overflow-hidden border border-border bg-background shadow-sm",
              device === "desktop"
                ? "rounded-lg"
                : device === "tablet"
                  ? "rounded-xl border-2"
                  : "rounded-[20px] border-2",
            )}
            style={{ width: width * scale, height: frameHeight * scale }}
          >
            <iframe
              ref={iframeRef}
              title="Template preview"
              sandbox="allow-scripts"
              srcDoc={shownSrcdoc}
              className="block origin-top-left border-0 bg-white"
              style={{ width, height: frameHeight, transform: `scale(${scale})` }}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex min-h-6 items-center justify-center gap-3 text-xs text-muted-foreground tabular-nums">
        <span>
          {width} × auto · {Math.round(scale * 100)}%
        </span>
        {errors.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 font-medium text-destructive"
              >
                <AlertCircle className="size-3" aria-hidden />
                {errors.length === 1 ? "1 script error" : `${errors.length} script errors`}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0">
              <ul className="max-h-64 divide-y divide-border overflow-auto font-mono text-xs">
                {errors.map((e, i) => (
                  <li key={i} className="px-3 py-2 break-words text-destructive">
                    {e}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
