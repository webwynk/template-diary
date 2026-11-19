import { PageContainer } from "@/components/common/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading screens shown the moment a link is clicked (speed audit P2). Each one has the rough
// shape of the page it stands in for, so the page doesn't jump when the real content arrives.
// They are announced once ("Loading") and the shapes themselves are hidden from screen readers.

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" className={className}>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

const CARD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

function CardSkeleton({ swatches = false }: { swatches?: boolean }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
      {swatches ? (
        <Skeleton className="m-3 mb-0 h-10 rounded-lg" />
      ) : (
        <Skeleton className="aspect-[16/10] rounded-none border-b border-border" />
      )}
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </li>
  );
}

/** Library and Favorites: toolbar, then a grid of template cards. */
export function LibrarySkeleton() {
  return (
    <PageContainer>
      <Loading>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="ml-auto h-9 w-20" />
        </div>
        <Skeleton className="mb-4 h-5 w-24" />
        <ul className={CARD_GRID}>
          {Array.from({ length: 8 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
      </Loading>
    </PageContainer>
  );
}

/** Palettes: a grid of preset cards. */
export function PaletteGridSkeleton() {
  return (
    <PageContainer>
      <Loading>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <ul className={CARD_GRID}>
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} swatches />
          ))}
        </ul>
      </Loading>
    </PageContainer>
  );
}

/** Rows with a thumbnail, two lines of text and actions (Trash, Settings → Tags). */
function RowsSkeleton({ rows = 5, thumb = true }: { rows?: number; thumb?: boolean }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {thumb ? <Skeleton className="hidden h-10 w-16 shrink-0 sm:block" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function TrashSkeleton() {
  return (
    <PageContainer>
      <Loading>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-28" />
        </div>
        <RowsSkeleton />
      </Loading>
    </PageContainer>
  );
}

/** Inside the Settings layout (its nav stays on screen). */
export function SettingsSkeleton() {
  return (
    <Loading className="flex flex-col gap-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-64" />
      <RowsSkeleton rows={4} thumb={false} />
    </Loading>
  );
}

/** Template overview: image on the left, details and variations on the right. */
export function TemplateOverviewSkeleton() {
  return (
    <PageContainer>
      <Loading>
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Skeleton className="aspect-[16/10] w-full max-w-[480px] rounded-xl" />
          <div className="flex min-w-0 flex-col gap-3">
            <Skeleton className="h-8 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-8 mb-3 h-6 w-28" />
        <RowsSkeleton rows={3} />
      </Loading>
    </PageContainer>
  );
}

/** New template form. */
export function FormSkeleton() {
  return (
    <PageContainer>
      <Loading className="flex flex-col gap-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </Loading>
    </PageContainer>
  );
}

/** Generic content area (first load of any page inside the app shell). */
export function ContentSkeleton() {
  return (
    <PageContainer>
      <Loading className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </Loading>
    </PageContainer>
  );
}

/** Full-screen editor: top bar, preview on the left, side panel on the right. */
export function EditorSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={cn("flex h-dvh flex-col overflow-hidden bg-background", className)}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Skeleton className="size-8" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="ml-auto h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-surface p-4">
          <Skeleton className="mx-auto h-8 w-40" />
          <Skeleton className="w-full flex-1 rounded-lg bg-background" />
        </div>
        <div className="hidden w-[360px] shrink-0 flex-col gap-3 border-l border-border p-4 md:flex">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** The app shell's outline (sidebar + top bar) for the very first paint, before the URL is known. */
export function ShellSkeleton() {
  return (
    <Loading className="flex min-h-svh w-full">
      <div className="sticky top-0 hidden h-svh w-16 shrink-0 border-r border-border bg-surface md:block lg:w-60" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6 lg:px-8">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="ml-auto h-9 w-9 sm:w-56" />
          <Skeleton className="h-9 w-9 sm:w-36" />
        </div>
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </Loading>
  );
}
