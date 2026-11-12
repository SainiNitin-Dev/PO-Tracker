"use client";
import { useEffect, useState } from "react";

export default function OperationFeedback() {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      setPending((count) => count + 1);
      try { return await originalFetch(...args); }
      finally { setPending((count) => Math.max(0, count - 1)); }
    };
    return () => { window.fetch = originalFetch; };
  }, []);
  if (!pending) return null;
  return <div aria-live="polite" className="fixed inset-x-0 bottom-24 z-[90] mx-auto w-max max-w-[calc(100vw-2rem)] animate-[fade-in_.18s_ease-out] rounded-full border border-sky-300/30 bg-[#102a43]/95 px-4 py-2 text-sm font-semibold text-sky-100 shadow-2xl backdrop-blur"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-sky-300"/>Working…</div>;
}
