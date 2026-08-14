/**
 * What a Server Action hands back so the UI can say what happened (design D6).
 *
 * A Server Action runs on the server and cannot call a client hook, so the
 * outcome has to travel as data: the action returns an `ActionResult`, the form
 * holds it with `useActionState`, and `useToastOnActionResult` turns a change of
 * result into a toast. Failure is a first-class result here, not an exception —
 * an action that throws tells the user nothing.
 */

export type ActionResult =
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

export function actionSuccess(message: string): ActionResult {
  return { status: "success", message };
}

export function actionError(message: string): ActionResult {
  return { status: "error", message };
}

/**
 * The message a refused action gets. The spec requires that a role refusal
 * explains itself rather than reporting a generic error, so the wording lives
 * in one place.
 */
export function actionRefused(action: string, role: string): ActionResult {
  return {
    status: "error",
    message: `Your role (${role}) does not permit ${action}.`,
  };
}

export function isActionResult(value: unknown): value is ActionResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { status?: unknown; message?: unknown };
  return (
    (candidate.status === "success" || candidate.status === "error") &&
    typeof candidate.message === "string"
  );
}
