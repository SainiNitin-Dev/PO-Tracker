import Link from "next/link";
export default function NotFound() {
  return (
    <main className="app-page max-w-xl">
      <header className="page-header">
        <p className="eyebrow">Page not found</p>
        <h1>A little off track.</h1>
        <p>This link may be out of date. Head home to pick up your training.</p>
      </header>
      <Link href="/" className="primary-action">
        Back home
      </Link>
    </main>
  );
}
