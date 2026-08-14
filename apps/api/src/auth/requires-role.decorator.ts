import type { AccountRole } from "@mela/database";
import { SetMetadata } from "@nestjs/common";

export const REQUIRES_ROLE_KEY = "requiresRole";

export interface RequiresRoleMetadata {
  role: AccountRole;
  action: string;
}

/**
 * Restricts a route to accounts holding at least the given role (design D4).
 *
 * Read by the same global `SessionGuard`, after it has already established
 * `request.account` — this only narrows further, it never substitutes for
 * the session check. `action` names what was refused in the error message,
 * so a viewer sees why, not just a bare 403.
 */
export const RequiresRole = (role: AccountRole, action: string): MethodDecorator =>
  SetMetadata(REQUIRES_ROLE_KEY, { role, action } satisfies RequiresRoleMetadata);
