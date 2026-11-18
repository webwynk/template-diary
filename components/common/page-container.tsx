import { cn } from "@/lib/utils";

/** Page padding and max width from DESIGN.md §4 (16 / 24 / 32px, max 1400px). */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8",
        className,
      )}
    >
      {children}
    </main>
  );
}
