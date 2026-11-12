import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6"><p className="text-sm font-medium uppercase tracking-[.2em] text-lime-400">Progressive</p><h1 className="text-4xl font-bold tracking-tight">Ready to train?</h1><Link className="rounded-xl bg-lime-400 px-5 py-4 text-center font-semibold text-zinc-950" href="/workout">Start today&apos;s workout</Link><Link className="rounded-xl border border-zinc-700 px-5 py-4 text-center font-semibold" href="/program">Edit program</Link><Link className="rounded-xl border border-zinc-700 px-5 py-4 text-center font-semibold" href="/progress">View progress</Link><Link className="rounded-xl border border-zinc-700 px-5 py-4 text-center font-semibold" href="/history">Exercise history & PRs</Link></main>;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <p className="text-sm font-medium uppercase tracking-[.2em] text-lime-400">Progressive</p>
      <h1 className="text-4xl font-bold tracking-tight">Train from your real data.</h1>
      <p className="text-zinc-400">Your private strength log and coaching companion.</p>
      <Link className="rounded-xl bg-lime-400 px-5 py-4 text-center font-semibold text-zinc-950" href="/login">Log in</Link>
    </main>
  );
}
