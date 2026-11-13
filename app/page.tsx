import Link from "next/link";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { Icon, type IconName } from "@/components/icon";

const links: { href: string; title: string; text: string; icon: IconName }[] = [
  {
    href: "/program",
    title: "Your plan",
    text: "Days, exercises, and targets",
    icon: "plan",
  },
  {
    href: "/history",
    title: "Workout history",
    text: "Past sessions and personal bests",
    icon: "chart",
  },
  {
    href: "/photos",
    title: "Progress photos",
    text: "A private view of your changes",
    icon: "camera",
  },
];
export default async function Home() {
  const identity = await getIdentity();
  if (!identity)
    return (
      <main className="app-page flex min-h-[75vh] max-w-4xl flex-col justify-center">
        <p className="eyebrow">Your training companion</p>
        <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[1.08] sm:text-7xl">
          Small steps.
          <br />
          <span className="text-[#687954]">Stronger you.</span>
        </h1>
        <p className="muted mt-6 max-w-md text-lg leading-relaxed">
          Keep track of your training, see your progress, and find your next
          step with a coach that knows your log.
        </p>
        <div className="mt-8">
          <Link href="/login" className="primary-action">
            Welcome back <Icon name="arrow" />
          </Link>
          <p className="muted mt-4 text-xs">
            New here? Ask your gym admin for an invitation.
          </p>
        </div>
        <div className="mt-14 grid gap-6 border-t border-[#ddded3] pt-6 sm:grid-cols-3">
          {[
            "Your workouts, remembered.",
            "Progress you can see.",
            "Private, by design.",
          ].map((text, i) => (
            <p key={text} className="text-sm">
              <span className="mr-3 text-xs text-[#788565]">0{i + 1}</span>
              {text}
            </p>
          ))}
        </div>
      </main>
    );
  if (identity.profile.role === "admin") redirect("/admin");
  const { supabase, user, profile } = identity;
  const now = new Date();
  const results = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("performed_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("performed_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .lte("performed_at", now.toISOString())
      .order("performed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("performed_at", new Date(now.getTime() - 7 * 86400000).toISOString())
      .lte("performed_at", now.toISOString()),
    supabase
      .from("programs")
      .select("id,name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  for (const result of results)
    if (result.error)
      throw new Error("Your training overview could not be loaded.");
  const [activeSession, lastSession, recentSessions, program] = results;
  const active = activeSession.data;
  const last = lastSession.data;
  const recent = recentSessions.count ?? 0;
  const name = profile.display_name || user.email?.split("@")[0] || "Athlete";
  return (
    <main className="app-page">
      <header className="page-header">
        <p className="eyebrow">Make room for progress</p>
        <h1>Good to see you, {name}.</h1>
        <p>Your next session starts here. Take it one set at a time.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl bg-[#e6eadb] p-6 sm:p-8">
          <p className="eyebrow">
            {active
              ? "Ready when you are"
              : program.data
                ? "Your active plan"
                : "A fresh start"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {active
              ? "Pick up where you left off."
              : program.data?.name || "Build your training rhythm."}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#57614c]">
            {active
              ? "Your saved sets are waiting. Continue your workout or finish it when you’re done."
              : program.data
                ? "Check your targets, choose your gym, and log your next session."
                : "Choose your training days and exercises to create a plan that fits your week."}
          </p>
          <Link
            href={active || program.data ? "/workout" : "/program"}
            className="primary-action mt-6"
          >
            {active
              ? "Resume workout"
              : program.data
                ? "Start training"
                : "Create a plan"}
            <Icon name="arrow" />
          </Link>
        </section>
        <section className="surface flex flex-col justify-between">
          <div>
            <p className="eyebrow">Your recent rhythm</p>
            <p className="metric-value mt-3">
              {recent}
              <span className="ml-2 text-base font-normal">
                session{recent === 1 ? "" : "s"}
              </span>
            </p>
            <p className="muted mt-1 text-sm">in the last 7 days</p>
          </div>
          <div className="mt-6 border-t border-[#e7e8df] pt-4">
            <p className="muted text-xs">Last completed workout</p>
            <p className="mt-1 text-sm font-semibold">
              {last
                ? new Date(last.performed_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Kolkata",
                  })
                : "Your first one is ahead of you"}
            </p>
            <Link href="/progress" className="quiet-action -ml-4 mt-2">
              See your progress <Icon name="arrow" />
            </Link>
          </div>
        </section>
      </div>
      <section className="mt-9">
        <div className="section-heading">
          <h2>Your training space</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="surface group hover:border-[#899978]"
            >
              <span className="text-[#657852]">
                <Icon name={link.icon} width={24} height={24} />
              </span>
              <h3 className="mt-5 font-semibold">{link.title}</h3>
              <p className="muted mt-1 text-sm">{link.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#ddded3] pt-6">
        <div>
          <h2 className="font-semibold">A question about your training?</h2>
          <p className="muted mt-1 text-sm">Talk it through with your coach.</p>
        </div>
        <Link href="/coach" className="secondary-action">
          <Icon name="coach" />
          Open coach
        </Link>
      </section>
    </main>
  );
}
