"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";
import ConfirmDialog, { type Confirmation } from "@/components/confirm-dialog";
type Metric = { id: string; recorded_at: string; bodyweight_kg: number | null };
export default function ProfileCard({
  userId,
  email,
  name,
  role,
  createdAt,
  metrics,
}: {
  userId: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  metrics: Metric[];
}) {
  const [working, setWorking] = useState("");
  const [refreshing, transition] = useTransition();
  const busy = Boolean(working) || refreshing;
  const router = useRouter();
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  const run = async (
    key: string,
    task: () => Promise<void>,
    success: string,
  ) => {
    setWorking(key);
    setMessage(null);
    try {
      await task();
      setMessage({ text: success });
      transition(() => router.refresh());
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "That didn’t save. Try again.",
        error: true,
      });
    } finally {
      setWorking("");
    }
  };
  const logout = () =>
    void run(
      "logout",
      async () => {
        const { error } = await client().auth.signOut({ scope: "local" });
        if (error) throw error;
        for (const key of Object.keys(localStorage))
          if (
            [
              `progressive:set:${userId}:`,
              `progressive:rest:${userId}:`,
              `progressive:workout:${userId}:`,
            ].some((prefix) => key.startsWith(prefix))
          )
            localStorage.removeItem(key);
        window.location.replace("/login");
      },
      "Logged out.",
    );
  const saveName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(
      "name",
      async () => {
        await requestJson(
          "/api/profile",
          { displayName: form.get("displayName") },
          "PATCH",
        );
      },
      "Your name is updated.",
    );
  };
  const savePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (password !== data.get("confirmPassword")) {
      setMessage({
        text: "The passwords do not match. Please check both fields.",
        error: true,
      });
      return;
    }
    void run(
      "password",
      async () => {
        const { error } = await client().auth.updateUser({ password });
        if (error) throw error;
        form.reset();
      },
      "Your password is updated.",
    );
  };
  const saveWeight = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    void run(
      "weight",
      async () => {
        await requestJson(
          "/api/metrics",
          Object.fromEntries(new FormData(form)),
        );
        form.reset();
      },
      "Body weight saved.",
    );
  };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">Your account</p>
        <h1>A space for you.</h1>
        <p>
          Manage your details, track your body weight, and make yourself at
          home.
        </p>
      </header>
      {message && (
        <p
          className="status-message mb-6"
          data-tone={message.error ? "error" : "success"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <section className="surface">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e5e9d9] text-xl font-semibold">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{name}</h2>
                <p className="muted mt-1 break-all text-sm">{email}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className="badge">
                {role === "admin" ? "Administrator" : "Member"}
              </span>
              <p className="muted text-xs">
                Since{" "}
                {new Date(createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <form onSubmit={saveName} className="mt-6 space-y-4">
              <label className="field">
                What should we call you?
                <input
                  name="displayName"
                  defaultValue={name}
                  autoComplete="name"
                  required
                  maxLength={120}
                />
              </label>
              <button className="secondary-action" disabled={busy}>
                {working === "name" ? "Saving…" : "Save name"}
              </button>
            </form>
          </section>
          <section className="surface">
            <h2 className="text-lg font-semibold">Password</h2>
            <form onSubmit={savePassword} className="mt-4 space-y-4">
              <label className="field">
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <small>Use at least 8 characters.</small>
              </label>
              <label className="field">
                Confirm new password
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
              <button className="secondary-action" disabled={busy}>
                {working === "password" ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
        <div className="space-y-6">
          {role === "user" && (
            <section className="surface">
              <h2 className="text-lg font-semibold">Body weight</h2>
              <p className="muted mt-2 text-sm">
                Optional, and visible only to you and your coach. Compare
                measurements taken under similar conditions.
              </p>
              <form onSubmit={saveWeight} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    Weight (kg)
                    <input
                      name="weight"
                      inputMode="decimal"
                      type="number"
                      step="0.1"
                      min="20"
                      max="500"
                      required
                    />
                  </label>
                  <label className="field">
                    Date
                    <input
                      name="date"
                      type="date"
                      defaultValue={today}
                      max={today}
                      min="2000-01-01"
                      required
                    />
                  </label>
                </div>
                <button className="primary-action" disabled={busy}>
                  {working === "weight" ? "Saving…" : "Save weight"}
                </button>
              </form>
              <div className="mt-5">
                {metrics.map((m) => (
                  <div key={m.id} className="data-row text-sm">
                    <div>
                      <span className="font-semibold">
                        {m.bodyweight_kg} kg
                      </span>
                      <span className="muted ml-3">
                        {new Date(
                          `${m.recorded_at}T12:00:00`,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <button
                      className="quiet-action"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          title: "Remove this measurement?",
                          description:
                            "This body weight entry will be permanently removed.",
                          label: "Remove",
                          onConfirm: () =>
                            void run(
                              "deleteWeight",
                              async () => {
                                await requestJson(
                                  "/api/metrics",
                                  { id: m.id },
                                  "DELETE",
                                );
                              },
                              "Measurement removed.",
                            ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!metrics.length && (
                  <p className="empty-state">
                    No measurements yet. Add your first whenever you’re ready.
                  </p>
                )}
              </div>
            </section>
          )}
          <section className="surface">
            <h2 className="text-lg font-semibold">Make it yours</h2>
            <div className="mt-4 flex flex-col gap-2">
              {role === "admin" ? (
                <Link
                  href="/admin"
                  className="secondary-action justify-between"
                >
                  Manage gym catalog <span>→</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/photos"
                    className="secondary-action justify-between"
                  >
                    Your progress photos <span>→</span>
                  </Link>
                  <Link
                    href="/coach"
                    className="secondary-action justify-between"
                  >
                    Coach & saved preferences <span>→</span>
                  </Link>
                </>
              )}
            </div>
            <details className="mt-5">
              <summary>Install on your iPhone</summary>
              <p className="muted mt-2 text-sm leading-relaxed">
                Open this site in Safari, tap Share, then Add to Home Screen. If
                shown, keep Open as Web App enabled. You can then launch
                Progressive from your home screen.
              </p>
            </details>
          </section>
          <button
            onClick={() => {
              const hasDrafts = Object.keys(localStorage).some((key) =>
                key.startsWith(`progressive:set:${userId}:`),
              );
              if (hasDrafts)
                setConfirmation({
                  title: "Log out of this device?",
                  description:
                    "Your saved workouts stay safe. Unsaved set drafts on this device will be cleared for privacy. Return to your workout to save them first.",
                  label: "Log out",
                  onConfirm: logout,
                });
              else logout();
            }}
            disabled={busy}
            className="danger-action w-full"
          >
            {working === "logout" ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
