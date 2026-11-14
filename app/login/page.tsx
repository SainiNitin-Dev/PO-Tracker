"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useMemo, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (recovering) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/auth/confirm` },
        );
        if (resetError) throw resetError;
        setMessage(
          "If this email has an account, a password reset link is on its way. Check your inbox and spam folder.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(
            signInError.code === "email_not_confirmed"
              ? "Open your invitation email to finish setting up your account first."
              : "We couldn’t log you in. Check your email and password, then try again.",
          );
          return;
        }
        // A full navigation also clears any prior account's client-side route data.
        window.location.assign("/");
      }
    } catch {
      setError(
        "We couldn’t connect. Check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-page max-w-md">
      <Link href="/" className="eyebrow">
        Progressive
      </Link>
      <header className="page-header">
        <h1>{recovering ? "Reset your password" : "Welcome back"}</h1>
        <p>
          {recovering
            ? "We’ll email you a link to choose a new password."
            : "A little stronger, one session at a time."}
        </p>
      </header>
      <form onSubmit={submit} className="surface stack" aria-busy={loading}>
        {!supabase && (
          <p role="alert" className="status-message" data-tone="error">
            Sign-in is not available yet. Ask your administrator to finish
            setting up the app.
          </p>
        )}
        <label className="field">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={loading}
          />
        </label>
        {!recovering && (
          <label className="field">
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="status-message" data-tone="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="status-message" data-tone="success">
            {message}
          </p>
        )}
        <button
          disabled={loading || !supabase}
          className="primary-action w-full"
        >
          {loading
            ? recovering
              ? "Sending link…"
              : "Logging in…"
            : recovering
              ? "Send reset link"
              : "Log in"}
        </button>
        <button
          type="button"
          className="quiet-action w-full"
          disabled={loading}
          onClick={() => {
            setRecovering(!recovering);
            setError("");
            setMessage("");
          }}
        >
          {recovering ? "Back to log in" : "Forgot password?"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        New here? Open the invitation from your gym administrator to set your
        password.
      </p>
    </main>
  );
}
