"use client";

import { useActionState, useMemo } from "react";

import type { SignInResult } from "@/app/(auth)/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionError, actionSuccess } from "@/lib/action-result";
import { useToastOnActionResult } from "@/lib/use-toast-on-action-result";

export function SignInForm({
  action,
  defaultEmail = "",
  defaultPassword = "",
}: {
  action: (prevState: SignInResult | null, formData: FormData) => Promise<SignInResult>;
  /** Development-only prefill (see `sign-in/page.tsx`); empty in production. */
  defaultEmail?: string;
  defaultPassword?: string;
}) {
  const [state, formAction, isPending] = useActionState<SignInResult | null, FormData>(
    action,
    null,
  );

  // The action predates `ActionResult`, so its `{ ok }` shape is translated here
  // rather than changed — a successful sign-in redirects and never returns.
  const result = useMemo(() => {
    if (state === null) return null;
    return state.ok ? actionSuccess("Signed in.") : actionError(state.error);
  }, [state]);

  useToastOnActionResult(result);

  return (
    <form action={formAction} className="w-full space-y-4">
      <Field className="gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={defaultEmail}
        />
      </Field>
      <Field className="gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue={defaultPassword}
        />
      </Field>

      {/* The toast announces the failure; this keeps it on the page too, so it
          is still there after the toast has dismissed itself. */}
      {state && !state.ok && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" pending={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
