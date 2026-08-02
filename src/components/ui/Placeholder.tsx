/** Marks a section that a later milestone fills in, so the shell is navigable now. */
export function Placeholder({ milestone, children }: { milestone: string; children: string }) {
  return (
    <div className="border-border bg-card/50 rounded-lg border border-dashed p-10 text-center">
      <p className="text-primary text-xs font-medium tracking-widest uppercase">{milestone}</p>
      <p className="text-muted-foreground mt-2 text-sm">{children}</p>
    </div>
  );
}
