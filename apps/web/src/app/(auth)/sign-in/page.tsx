import { SignInForm } from "@/components/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { signInAction } from "./actions";

/**
 * Development convenience: the form arrives filled in with the account
 * `pnpm --filter @mela/api seed:accounts` creates, so signing in locally is one
 * click. `DEV_SIGN_IN_EMAIL` / `DEV_SIGN_IN_PASSWORD` override it for anyone
 * using a different local account.
 *
 * Both are read on the server and forced empty in production, so no credential
 * is ever prefilled in a real deployment. The seeded password is a local-only
 * fixture — its own script refuses to run against anything but a development
 * database on this machine.
 */
const SEEDED_DEV_EMAIL = "dev@mela.local";
const SEEDED_DEV_PASSWORD = "DevPassword123!";

function developmentCredentials(): { email: string; password: string } {
  if (process.env.NODE_ENV === "production") {
    return { email: "", password: "" };
  }

  return {
    email: process.env.DEV_SIGN_IN_EMAIL ?? SEEDED_DEV_EMAIL,
    password: process.env.DEV_SIGN_IN_PASSWORD ?? SEEDED_DEV_PASSWORD,
  };
}

export default function SignInPage() {
  const { email, password } = developmentCredentials();

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col gap-1 text-center">
        <span className="text-xl font-bold tracking-tight">MELA</span>
        <p className="text-sm text-muted-foreground">Middle East Lead Agent</p>
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-1">
          {/* The page's single `h1` — the card's own title slot is a lower
              level, and a sign-in page has nothing above this. */}
          <h1 className="text-base font-semibold tracking-tight">Sign in</h1>
          <CardDescription>Use your workspace account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm action={signInAction} defaultEmail={email} defaultPassword={password} />
        </CardContent>
      </Card>
    </div>
  );
}
