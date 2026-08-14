import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { getCurrentAccount } from "@/lib/session";

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

  return (
    <>
      <Header account={account} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  );
}
