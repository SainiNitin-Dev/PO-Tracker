export default function Loading() {
  return (
    <main className="app-page" aria-busy="true" aria-label="Loading page">
      <p role="status" className="muted mb-6 flex items-center gap-2 text-sm">
        <span className="spinner" />
        Loading your page…
      </p>
      <div className="skeleton mb-4 h-10 w-2/3" />
      <div className="skeleton mb-8 h-4 w-1/2" />
      <div className="skeleton h-48 w-full" />
    </main>
  );
}
