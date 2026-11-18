import { Button } from "@/components/ui/button";

// Phase 0 placeholder. Replaced by the Library screen in Phase 4.
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-background p-8 text-center">
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.01em]">Template Diary</h1>
        <p className="mt-2 text-muted-foreground">
          Project setup is complete. The library arrives in the next phases.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
        </div>
        <p className="mt-6 font-mono text-[13px] text-muted-foreground">#4F46E5</p>
      </div>
    </main>
  );
}
