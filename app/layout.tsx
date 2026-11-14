import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getIdentity } from "@/lib/auth";
import PwaRegister from "@/components/pwa-register";
import MobileNav from "@/components/mobile-nav";
import RouteFeedback from "@/components/route-feedback";
import OperationFeedback from "@/components/operation-feedback";
import { Analytics } from "@vercel/analytics/next";

// Account-specific navigation and pages must never be generated or cached globally.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Progressive", template: "%s · Progressive" },
  description: "Your private strength log and training companion.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/progressive-logo.png", apple: "/progressive-logo.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Progressive",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f2eb",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const identity = await getIdentity();
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <PwaRegister />
        <RouteFeedback />
        <OperationFeedback />
        <MobileNav
          role={identity?.profile.role ?? null}
          name={identity?.profile.display_name || "Member"}
        />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
