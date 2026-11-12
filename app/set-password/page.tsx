"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SetPasswordPage() {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const router = useRouter();
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setReady(true); if (!data.session) setError("This invitation link is invalid or has expired. Ask the admin to send a new invite."); }); }, [supabase]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); if (password.length < 8) return setError("Use at least 8 characters."); if (password !== confirm) return setError("Passwords do not match."); setSaving(true); const { error: updateError } = await supabase.auth.updateUser({ password }); if (updateError) { setError(updateError.message); setSaving(false); return; } router.replace("/"); router.refresh(); };
  return <main className="app-page flex flex-col justify-center"><img src="/progressive-logo.png" alt="Progressive" className="mb-8 w-24 rounded-3xl shadow-2xl"/><p className="eyebrow">You&apos;re invited</p><h1 className="mt-2 text-4xl font-black">Set your password</h1><p className="mt-3 text-slate-400">Finish setting up your private training account.</p><form onSubmit={submit} className="surface mt-8 space-y-5 p-5"><label className="block text-sm font-semibold">New password<input disabled={!ready || Boolean(error)} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-2xl p-4"/></label><label className="block text-sm font-semibold">Confirm password<input disabled={!ready || Boolean(error)} required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full rounded-2xl p-4"/></label>{error && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<button disabled={!ready || Boolean(error) || saving} className="primary-action w-full">{saving ? "Setting up…" : "Finish setup"}</button></form></main>;
}
