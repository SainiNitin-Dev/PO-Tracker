"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const tabs = [{ href: "/", icon: "⌂", label: "Home" }, { href: "/workout", icon: "◉", label: "Train" }, { href: "/progress", icon: "↗", label: "Progress" }, { href: "/coach", icon: "✦", label: "Coach" }];
export default function MobileNav() { const path = usePathname(); if (path === "/login" || path.startsWith("/admin")) return null; return <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center justify-around rounded-2xl border border-white/10 bg-[#0b1a2c]/95 p-2 shadow-2xl backdrop-blur-xl">{tabs.map((tab) => <Link key={tab.href} href={tab.href} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold ${path === tab.href ? "bg-lime-400 text-slate-950" : "text-slate-400"}`}><span className="text-base leading-none">{tab.icon}</span>{tab.label}</Link>)}</nav>; }
