"use client";
import { useEffect } from "react";
import { OFFLINE_OWNER_KEY, offlineWorkoutKey } from "@/lib/offline-workout";
import { requestJson } from "@/lib/client-request";

export default function PwaRegister({ memberId }: { memberId: string | null }) {
  useEffect(() => {
    try {
      const owner = localStorage.getItem(OFFLINE_OWNER_KEY);
      if (owner && owner !== memberId)
        localStorage.removeItem(OFFLINE_OWNER_KEY);
    } catch {
      // Offline storage may be unavailable in this browser.
    }
  }, [memberId]);
  useEffect(() => {
    if (!memberId) return;
    const key = offlineWorkoutKey(memberId);
    let syncing = false;
    async function sync() {
      if (syncing || !navigator.onLine) return;
      syncing = true;
      try {
        const saved = localStorage.getItem(key);
        if (!saved) return;
        const { plan, workout } = JSON.parse(saved);
        if (plan?.userId !== memberId || !workout?.finishedAt) return;
        const result = await requestJson<{ id: string }>(
          "/api/workouts/offline",
          { ...plan, ...workout },
        );
        if (result.id === workout.id && localStorage.getItem(key) === saved) {
          localStorage.removeItem(key);
          window.dispatchEvent(new Event("progressive:offline-synced"));
        }
      } catch {
        // The offline page keeps the workout available and can surface sync errors.
      } finally {
        syncing = false;
      }
    }
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [memberId]);
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, []);
  return null;
}
