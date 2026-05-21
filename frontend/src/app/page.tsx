export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-16">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Phase 1.4</p>
        <h1 className="text-4xl font-semibold">ParseArena</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Frontend scaffold is ready. Upload, parse trigger, and result viewer UI will be wired in
          upcoming phases.
        </p>
      </div>
    </main>
  );
}
