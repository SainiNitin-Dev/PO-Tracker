"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useMemo, useRef, useState } from "react";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "expired">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const codeExchange = useRef<ReturnType<NonNullable<typeof supabase>["auth"]["exchangeCodeForSession"]> | null>(null);
  const supabase = useMemo(
    () =>
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          )
        : null,
    [],
  );

  useEffect(() => {
    let current = true;
    async function verify() {
      if (!supabase) {
        if (current) {
          setStatus("expired");
          setError(
            "Sign-in is not available yet. Ask your administrator to finish setting up the app.",
          );
        }
        return;
      }
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const query = new URLSearchParams(window.location.search);
        if (params.has("error") || query.has("error")) throw new Error();
        const code = query.get("code");
        if (code) {
          codeExchange.current ??= supabase.auth.exchangeCodeForSession(code);
          const { error: codeError } = await codeExchange.current;
          if (codeError) throw codeError;
        }
        // Admin invitations use an implicit token link, while the SSR client
        // uses PKCE. Explicitly establish the invite session for both browsers.
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          window.history.replaceState({}, "", "/set-password");
          const { error: tokenError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (tokenError) throw tokenError;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error();
        const { error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        window.history.replaceState({}, "", "/set-password");
        if (current) setStatus("ready");
      } catch {
        if (current) {
          setStatus("expired");
          setError(
            "This link has expired or has already been used. Request a password reset, or ask your gym administrator for a new invitation.",
          );
        }
      }
    }
    void verify();
    return () => {
      current = false;
    };
  }, [supabase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don’t match. Please try again.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(
          updateError.code === "same_password"
            ? "Choose a password you haven’t used before."
            : "We couldn’t update your password. Check your connection and try again.",
        );
        return;
      }
      window.location.assign("/");
    } catch {
      setError(
        "We couldn’t connect. Check your internet connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-page max-w-md">
      <Link href="/" className="eyebrow">
        Progressive
      </Link>
      <header className="page-header">
        <h1>Choose your password</h1>
        <p>Keep your training account private and easy to return to.</p>
      </header>
      {status === "loading" ? (
        <p role="status" className="status-message">
          Checking your secure link…
        </p>
      ) : status === "expired" ? (
        <section className="surface stack">
          <p role="alert" className="status-message" data-tone="error">
            {error}
          </p>
          <Link href="/login" className="primary-action">
            Go to log in
          </Link>
        </section>
      ) : (
        <form onSubmit={submit} className="surface stack" aria-busy={saving}>
          <label className="field">
            New password
            <input
              disabled={saving}
              required
              minLength={8}
              maxLength={128}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-help"
            />
          </label>
          <p id="password-help" className="text-sm text-muted">
            Use at least 8 characters.
          </p>
          <label className="field">
            Confirm password
            <input
              disabled={saving}
              required
              minLength={8}
              maxLength={128}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="status-message" data-tone="error">
              {error}
            </p>
          )}
          <button disabled={saving} className="primary-action w-full">
            {saving ? "Saving password…" : "Save password & continue"}
          </button>
        </form>
      )}
    </main>
  );
}
