import "./globals.css";
import type { Metadata } from "next";
import PwaRegister from "@/components/pwa-register";
import MobileNav from "@/components/mobile-nav";
import RouteFeedback from "@/components/route-feedback";
import OperationFeedback from "@/components/operation-feedback";

export const metadata: Metadata = { title: "Progressive", description: "Personal training log", manifest: "/manifest.webmanifest", icons: { icon: "/progressive-logo.png", apple: "/progressive-logo.png" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegister /><RouteFeedback /><OperationFeedback />{children}<MobileNav /></body></html>;
}
