"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-page max-w-xl">
      <div className="page-header">
        <p className="eyebrow">Something interrupted this page</p>
        <h1>Let’s try that again.</h1>
        <p>
          We couldn’t load your information. Check your connection and retry.
          Your saved training data is still there.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="primary-action">
          Try again
        </button>
        <Link href="/" className="secondary-action">
          Go home
        </Link>
      </div>
    </main>
  );
}
