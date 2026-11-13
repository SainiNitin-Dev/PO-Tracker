"use client";
import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

const memberTabs: { href: string; icon: IconName; label: string }[] = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/workout", icon: "train", label: "Train" },
  { href: "/progress", icon: "chart", label: "Progress" },
  { href: "/coach", icon: "coach", label: "Coach" },
  { href: "/profile", icon: "user", label: "Profile" },
];
const adminTabs: typeof memberTabs = [
  { href: "/admin", icon: "train", label: "Catalog" },
  { href: "/admin/muscles", icon: "plan", label: "Muscles" },
  { href: "/profile", icon: "user", label: "Profile" },
];
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="spinner !h-3 !w-3" aria-label="Loading" />
  ) : null;
}
export default function MobileNav({
  role,
  name,
}: {
  role: string | null;
  name: string;
}) {
  const path = usePathname();
  if (["/login", "/set-password"].includes(path)) return null;
  const tabs = role === "admin" ? adminTabs : memberTabs;
  return (
    <>
      <header className="border-b border-[#dedfd4] bg-[#fffefb]">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link
            href={role === "admin" ? "/admin" : "/"}
            className="flex items-center gap-3 text-lg font-semibold tracking-tight"
            aria-label="Progressive home"
          >
            <Image
              src="/progressive-logo.png"
              alt=""
              width={38}
              height={38}
              className="rounded-lg"
              priority
            />
            Progressive
            <span className="hidden text-xs font-normal tracking-normal text-[#686a60] lg:inline">
              {role === "admin"
                ? "Gym management"
                : "A little stronger, every day."}
            </span>
          </Link>
          {role ? (
            <nav
              aria-label="Main navigation"
              className="hidden items-center gap-1 md:flex"
            >
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={path === tab.href ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${path === tab.href ? "bg-[#edf0e5] text-[#3d4e30]" : "text-[#686a60] hover:bg-[#f5f5ef]"}`}
                >
                  {tab.label}
                  <Pending />
                </Link>
              ))}
            </nav>
          ) : (
            <Link href="/login" className="secondary-action">
              Log in
            </Link>
          )}
          {role && (
            <Link
              href="/profile"
              aria-label={`Your account: ${name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5e9d9] text-sm font-semibold md:hidden"
            >
              {name.slice(0, 1).toUpperCase()}
            </Link>
          )}
        </div>
      </header>
      {role && (
        <nav
          aria-label="Mobile navigation"
          className="app-nav fixed inset-x-0 bottom-0 z-50 border-t border-[#d7d9ce] bg-[#fffefb] px-2 pt-2 md:hidden"
        >
          <div className="mx-auto flex max-w-xl justify-around">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={path === tab.href ? "page" : undefined}
                className={`flex min-h-[52px] min-w-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold ${path === tab.href ? "bg-[#e9eddf] text-[#3d4e30]" : "text-[#686a60]"}`}
              >
                <Icon name={tab.icon} />
                <span className="flex items-center gap-1">
                  {tab.label}
                  <Pending />
                </span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
