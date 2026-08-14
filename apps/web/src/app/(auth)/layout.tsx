/** No header, no sidebar — the sign-in page is reachable before anyone is signed in. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 items-center justify-center p-6">{children}</main>;
}
