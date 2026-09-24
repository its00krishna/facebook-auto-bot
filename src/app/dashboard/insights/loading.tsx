export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading insights">
      <div className="h-11 w-60 animate-pulse rounded-xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="h-80 animate-pulse rounded-card bg-surface-2" />
        <div className="h-80 animate-pulse rounded-card bg-surface-2" />
      </div>
    </div>
  );
}
