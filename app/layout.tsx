import "./globals.css";
import type { Metadata } from "next";
import PwaRegister from "@/components/pwa-register";

export const metadata: Metadata = { title: "Progressive", description: "Personal training log", manifest: "/manifest.webmanifest" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaRegister />{children}</body></html>;
}
