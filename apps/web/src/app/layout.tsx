import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
