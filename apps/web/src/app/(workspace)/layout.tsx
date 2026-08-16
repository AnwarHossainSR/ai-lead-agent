import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { readFlashToast } from "@/lib/flash-toast.server";
import { readNavigationCounts } from "@/lib/navigation-counts";
import { getCurrentAccount } from "@/lib/session";
import { readSidebarCollapsed } from "@/lib/sidebar";
import { readThemePreference } from "@/lib/theme.server";

/**
 * The workspace shell: a full-height sidebar beside a column holding the top
 * bar and the page.
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
  //
  // The navigation counts are read alongside rather than awaited in sequence,
  // and they resolve to an empty record on failure — one slow count must not
  // hold up every page in the workspace, and must not report an empty queue
  // when the truth is that nobody could read it (design D8).
  const [flashToast, theme, sidebarCollapsed, counts] = await Promise.all([
    readFlashToast(),
    readThemePreference(),
    readSidebarCollapsed(),
    readNavigationCounts(),
  ]);

  return (
    <ToastProvider initialToast={flashToast}>
      <div className="flex min-h-full">
        <Sidebar account={account} counts={counts} defaultCollapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header account={account} theme={theme} counts={counts} />
          <main className="mx-auto w-full max-w-(--size-content-max) flex-1 px-3.5 pt-6 pb-11 md:px-8 md:pt-8 md:pb-14">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
