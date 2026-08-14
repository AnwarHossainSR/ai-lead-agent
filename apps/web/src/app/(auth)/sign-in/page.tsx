import { SignInForm } from "@/components/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { signInAction } from "./actions";

/**
 * Development convenience: with `DEV_SIGN_IN_EMAIL` and `DEV_SIGN_IN_PASSWORD`
 * set in `.env.local`, the form arrives filled in so a local account can be
 * used without retyping it. Both are read on the server and are ignored outside
 * development, so no credential is ever prefilled in a real deployment — and
 * none is committed to the repository.
 */
function developmentCredentials(): { email: string; password: string } {
  if (process.env.NODE_ENV === "production") {
    return { email: "", password: "" };
  }

  return {
    email: process.env.DEV_SIGN_IN_EMAIL ?? "",
    password: process.env.DEV_SIGN_IN_PASSWORD ?? "",
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
