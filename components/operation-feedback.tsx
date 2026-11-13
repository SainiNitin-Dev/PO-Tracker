"use client";
import { useEffect, useState } from "react";
export default function OperationFeedback() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[110] bg-[#504c35] p-3 text-center text-sm text-white"
    >
      You’re offline. Reconnect to sync changes.
    </p>
  ) : null;
}
