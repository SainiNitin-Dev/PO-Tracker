"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    router.replace("/"); router.refresh();
  }
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"><form onSubmit={submit} className="space-y-4 rounded-2xl bg-zinc-900 p-6"><h1 className="text-2xl font-bold">Welcome back</h1><label className="block text-sm">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg bg-zinc-800 p-3" /></label><label className="block text-sm">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-zinc-800 p-3" /></label>{error && <p className="text-sm text-red-400">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-lime-400 p-3 font-semibold text-zinc-950">{loading ? "Logging in…" : "Log in"}</button></form></main>;
}
