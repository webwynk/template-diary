import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading code editor" className="h-full min-h-[420px] w-full p-4">
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="mb-2 h-4 w-1/2" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
