"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
export default function RouteFeedback() {
  const path = usePathname();
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setLoading(false);
    if (timer.current) clearTimeout(timer.current);
  }, [path]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.origin !== location.origin ||
        link.pathname === location.pathname
      )
        return;
      setLoading(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setLoading(false), 15000);
    };
    const clear = () => setLoading(false);
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", clear);
    window.addEventListener("pageshow", clear);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", clear);
      window.removeEventListener("pageshow", clear);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return loading ? (
    <div
      role="status"
      aria-label="Opening page"
      className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-[#dce3cc]"
    >
      <div className="route-progress h-full w-1/4 bg-[#4c5c3e]" />
    </div>
  ) : null;
}
