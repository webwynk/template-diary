"use client";

import { Code2, Eye, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { toast } from "sonner";

import { CodePane, type CodeView } from "@/components/editor/code-pane";
import { DEVICES, type DeviceId } from "@/components/editor/devices";
import { EditorTopBar } from "@/components/editor/editor-top-bar";
import { PalettePanel } from "@/components/editor/palette/palette-panel";
import { PreviewPane } from "@/components/editor/preview-pane";
import { SaveVariationDialog } from "@/components/editor/save-variation-dialog";
import { useEditorSession } from "@/components/editor/use-editor-session";
import type { CodeEditorApi } from "@/components/templates/monaco-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { EditorData } from "@/lib/db/templates";
import type { EditorState } from "@/lib/editor/session";
import type { Location } from "@/lib/engine/types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

type Confirm = { kind: "leave"; href: string } | { kind: "resetAll" };
type MobileTab = "code" | "preview" | "palette";

/** The editor screen (DESIGN.md §7.5): code, live preview and palette over one editing session. */
export function TemplateEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const { template, base } = data;
  const session = useEditorSession(base.content, template.type);
  const { state, dispatch, detection, output, dirty } = session;

  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isTablet = useMediaQuery("(min-width: 768px)");
  const layout = isDesktop === null ? null : isDesktop ? "desktop" : isTablet ? "tablet" : "mobile";

  const [device, setDevice] = useState<DeviceId>("desktop");
  const [mobileDeviceSet, setMobileDeviceSet] = useState(false);
  if (layout === "mobile" && !mobileDeviceSet) {
    // DESIGN.md §7.5: the device control defaults to 375 on mobile.
    setMobileDeviceSet(true);
    setDevice("mobile");
  }
  const [codeView, setCodeView] = useState<CodeView>("code");
  const [mobileTab, setMobileTab] = useState<MobileTab>("preview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // --- Unsaved-changes guard ------------------------------------------------------------------
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (leavingRef.current) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const navigate = useCallback(
    (href: string) => {
      if (dirty) setConfirm({ kind: "leave", href });
      else router.push(href);
    },
    [dirty, router],
  );

  // --- Jump from the palette to the code ------------------------------------------------------
  const apiRef = useRef<CodeEditorApi | null>(null);
  const pendingRevealRef = useRef<{ offset: number; length: number } | null>(null);
  const onEditorReady = useCallback((api: CodeEditorApi | null) => {
    apiRef.current = api;
    const reveal = pendingRevealRef.current;
    if (api && reveal) {
      pendingRevealRef.current = null;
      api.revealOffset(reveal.offset, reveal.length);
    }
  }, []);
  const onJump = useCallback(
    (location: Location) => {
      if (location.kind !== "range") return;
      const reveal = { offset: location.start, length: location.end - location.start };
      setPaletteOpen(false);
      setMobileTab("code");
      if (codeView === "code" && apiRef.current) {
        // Let a closing sheet or tab switch finish before Monaco takes focus.
        requestAnimationFrame(() => apiRef.current?.revealOffset(reveal.offset, reveal.length));
      } else {
        pendingRevealRef.current = reveal;
        setCodeView("code");
      }
    },
    [codeView],
  );

  // --- Keyboard: Ctrl/⌘+S saves, 1/2/3 switch the preview width --------------------------------
  const canSave = dirty && output.ok;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canSave) setSaveOpen(true);
        else toast.info("There are no changes to save yet.");
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='dialog'], .monaco-editor",
        )
      )
        return;
      const index = ["1", "2", "3"].indexOf(event.key);
      if (index >= 0 && template.type === "custom") setDevice(DEVICES[index]!.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSave, template.type]);

  // --- Save -----------------------------------------------------------------------------------
  function onSaved(id: string, name: string) {
    const content = output.ok ? output.content : null;
    setSaveOpen(false);
    leavingRef.current = true;
    toast.success(`Variation “${name}” saved`, {
      action: content
        ? {
            label: "Copy code",
            onClick: () => {
              navigator.clipboard.writeText(content).then(
                () => toast.success("Copied"),
                () => toast.error("Couldn't copy. Try again."),
              );
            },
          }
        : undefined,
    });
    // The page is keyed by the base, so the editor restarts from the new variation.
    router.replace(`/templates/${template.id}/edit?base=${id}`);
  }

  const resetAll = () => {
    if (session.codeEdited) setConfirm({ kind: "resetAll" });
    else dispatch({ type: "resetAll" });
  };

  // --- Panes ------------------------------------------------------------------------------------
  const errorText = session.detectError ?? (output.ok ? null : output.error);
  const code = (
    <CodePane
      type={template.type}
      source={state.source}
      onSourceChange={(source) => dispatch({ type: "setSource", source })}
      result={output.ok ? output.content : null}
      marks={session.marks}
      error={errorText}
      view={codeView}
      onViewChange={setCodeView}
      onReady={onEditorReady}
    />
  );
  const preview = (
    <PreviewPane
      type={template.type}
      content={output.ok ? output.content : null}
      device={device}
      onDeviceChange={setDevice}
    />
  );
  const palette = (
    <PalettePanel
      detection={detection}
      pending={state.pending}
      dispatch={dispatch}
      onJump={template.type === "custom" ? onJump : undefined}
      canReset={dirty || hasPending(state.pending)}
      onResetAll={resetAll}
    />
  );

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <EditorTopBar
          data={data}
          dirty={dirty}
          canSave={canSave}
          onBack={() => navigate(`/templates/${template.id}`)}
          onSwitchBase={(id) => navigate(`/templates/${template.id}/edit?base=${id}`)}
          onSave={() => setSaveOpen(true)}
          onOpenPalette={layout === "tablet" ? () => setPaletteOpen(true) : undefined}
        />

        <main className="min-h-0 flex-1">
          {layout === null ? null : layout === "desktop" ? (
            <DesktopPanes code={code} preview={preview} palette={palette} />
          ) : layout === "tablet" ? (
            <TabletPanes code={code} preview={preview} />
          ) : (
            <div className="h-full">
              <div className={cn("h-full", mobileTab !== "code" && "hidden")}>{code}</div>
              <div className={cn("h-full", mobileTab !== "preview" && "hidden")}>{preview}</div>
              <div className={cn("h-full", mobileTab !== "palette" && "hidden")}>{palette}</div>
            </div>
          )}
        </main>

        {layout === "mobile" ? <MobileTabs value={mobileTab} onChange={setMobileTab} /> : null}
      </div>

      {layout === "tablet" ? (
        <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
          <SheetContent side="right" className="w-[360px] gap-0 p-0 sm:max-w-[360px]">
            <SheetTitle className="sr-only">Palette</SheetTitle>
            <SheetDescription className="sr-only">
              Colors, images and fonts found in this template.
            </SheetDescription>
            <div className="min-h-0 flex-1 pt-10">{palette}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      <SaveVariationDialog
        key={saveOpen ? "open" : "closed"}
        open={saveOpen}
        onOpenChange={setSaveOpen}
        ready={session.inSync}
        request={{
          templateId: template.id,
          baseVariationId: base.id,
          source: state.source,
          swaps: session.swaps,
          summary: session.summary,
        }}
        onSaved={onSaved}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "resetAll" ? "Reset all changes?" : "Discard changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "resetAll"
                ? "Your code edits and palette changes are undone. This can't be reversed."
                : "Your changes haven't been saved as a variation and will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm?.kind === "resetAll") {
                  dispatch({ type: "resetAll" });
                } else if (confirm) {
                  leavingRef.current = true;
                  router.push(confirm.href);
                }
                setConfirm(null);
              }}
            >
              {confirm?.kind === "resetAll" ? "Reset all" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function hasPending(pending: EditorState["pending"]) {
  return Object.values(pending).some((rows) => Object.keys(rows).length > 0);
}

function DesktopPanes({
  code,
  preview,
  palette,
}: {
  code: React.ReactNode;
  preview: React.ReactNode;
  palette: React.ReactNode;
}) {
  // Sizes are remembered in localStorage (DESIGN.md §7.5).
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "td-editor-desktop" });
  return (
    <ResizablePanelGroup defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <ResizablePanel id="code" defaultSize="35%" minSize="20%" collapsible collapsedSize="0%">
        {code}
      </ResizablePanel>
      <ResizableHandle aria-label="Resize code and preview" />
      <ResizablePanel id="preview" minSize="25%">
        {preview}
      </ResizablePanel>
      <ResizableHandle aria-label="Resize preview and palette" />
      <ResizablePanel id="palette" defaultSize="320px" minSize="280px" maxSize="480px">
        {palette}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function TabletPanes({ code, preview }: { code: React.ReactNode; preview: React.ReactNode }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "td-editor-tablet" });
  return (
    <ResizablePanelGroup defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <ResizablePanel id="code" defaultSize="45%" minSize="25%">
        {code}
      </ResizablePanel>
      <ResizableHandle aria-label="Resize code and preview" />
      <ResizablePanel id="preview" minSize="30%">
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const MOBILE_TABS = [
  { id: "code", label: "Code", icon: Code2 },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "palette", label: "Palette", icon: Palette },
] as const;

function MobileTabs({ value, onChange }: { value: MobileTab; onChange: (tab: MobileTab) => void }) {
  return (
    <nav
      aria-label="Editor sections"
      className="flex shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {MOBILE_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
            value === t.id && "text-primary",
          )}
        >
          <t.icon className="size-5" aria-hidden />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
