import { Sparkles } from "lucide-react";

export function PageStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Coming soon — ask Lovable to build this page next.
        </p>
      </div>
    </div>
  );
}