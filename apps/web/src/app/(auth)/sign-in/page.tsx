import { SignInForm } from "@/components/sign-in-form";
import { signInAction } from "./actions";

export default function SignInPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MELA</h1>
        <p className="text-muted-foreground">Sign in to continue.</p>
      </div>
      <SignInForm action={signInAction} />
    </div>
  );
}
