import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { readFlashToast } from "@/lib/flash-toast.server";
import { getCurrentAccount } from "@/lib/session";
import { readSidebarCollapsed } from "@/lib/sidebar";
import { readThemePreference } from "@/lib/theme.server";

/**
 * The workspace shell: header (account + sign-out, task 8.3) and sidebar
 * navigation around every dashboard page.
 *
 * `middleware.ts` (task 8.2) already redirects an unauthenticated request
 * before it gets here on the happy path — this is the second, authoritative
 * check: middleware only sees whether the cookie exists, not whether the
 * API still honours it (expired, revoked, disabled account), and only this
 * layout can actually ask.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();

  if (account === null) {
    redirect("/sign-in");
  }

  // An action that redirected here left its outcome in the flash cookie; the
  // provider raises it once and clears the cookie (design D6).
  const [flashToast, theme, sidebarCollapsed] = await Promise.all([
    readFlashToast(),
    readThemePreference(),
    readSidebarCollapsed(),
  ]);

  return (
    <ToastProvider initialToast={flashToast}>
      <Header account={account} theme={theme} />
      <div className="flex flex-1">
        <Sidebar defaultCollapsed={sidebarCollapsed} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
