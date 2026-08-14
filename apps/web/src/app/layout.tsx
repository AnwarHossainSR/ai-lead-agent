import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { themeClass, themeColorScheme } from "@/lib/theme";
import { readThemePreference } from "@/lib/theme.server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The display face: headings and every figure the reader compares. Geist runs
 * the interface, Space Grotesk gives it a voice, and Geist Mono carries
 * evidence — URLs, ids, cited text — where character-level accuracy matters.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MELA - Middle East Lead Agent",
  description: "AI-assisted B2B lead generation and sales intelligence platform",
};

/**
 * The one root layout Next.js allows — `html`/`body` and nothing else.
 * The workspace shell (header, sidebar) lives in `(workspace)/layout.tsx`
 * instead, since the sign-in page under `(auth)` must not render it: a
 * shell showing account info and workspace navigation makes no sense before
 * anyone is signed in (dashboard spec: "no workspace data is rendered").
 *
 * The theme class is written here, during server rendering (design D4), so the
 * first paint is already in the chosen theme — there is no moment at which the
 * other one is visible.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await readThemePreference();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${themeClass(theme)} h-full antialiased`}
      style={{ colorScheme: themeColorScheme(theme) }}
      data-theme={theme}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
