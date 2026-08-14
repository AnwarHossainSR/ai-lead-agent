import { ToastProvider } from "@/components/ui/toast";
import { readFlashToast } from "@/lib/flash-toast.server";

/** No header, no sidebar — the sign-in page is reachable before anyone is signed in. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Signing out redirects here, and its confirmation travels in the flash
  // cookie — so this side of the app needs the toast surface too.
  const flashToast = await readFlashToast();

  return (
    <ToastProvider initialToast={flashToast}>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </ToastProvider>
  );
}
