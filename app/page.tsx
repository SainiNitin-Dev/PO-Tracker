import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <p className="text-sm font-medium uppercase tracking-[.2em] text-lime-400">Progressive</p>
      <h1 className="text-4xl font-bold tracking-tight">Train from your real data.</h1>
      <p className="text-zinc-400">Your private strength log and coaching companion.</p>
      <Link className="rounded-xl bg-lime-400 px-5 py-4 text-center font-semibold text-zinc-950" href="/login">Log in</Link>
    </main>
  );
}
