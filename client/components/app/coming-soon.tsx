export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Coming soon</p>
    </section>
  );
}
