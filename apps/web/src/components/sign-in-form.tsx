"use client";

import { useActionState } from "react";

import type { SignInResult } from "@/app/(auth)/sign-in/actions";
import { Button } from "@/components/ui/button";

export function SignInForm({
  action,
}: {
  action: (prevState: SignInResult | null, formData: FormData) => Promise<SignInResult>;
}) {
  const [state, formAction, isPending] = useActionState<SignInResult | null, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
