import { AUTHENTICATION_CONFIG } from "@mela/config";
import {
  ACCOUNT_ROLES,
  type AccountRole,
  type Database,
  changeAccountRole,
  disableAccount,
  insertAccount,
  listAccounts,
} from "@mela/database";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { z } from "zod";

import { hashPassword } from "../auth/password";
import { RequiresRole } from "../auth/requires-role.decorator";
import { DATABASE } from "../database/database.module";
import { createZodDto } from "../validation/zod-dto";

const createAccountSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Expected a valid email address.")),
  password: z
    .string()
    .min(
      AUTHENTICATION_CONFIG.minimumPasswordLength,
      `The password must be at least ${AUTHENTICATION_CONFIG.minimumPasswordLength} characters.`,
    ),
  role: z.enum(ACCOUNT_ROLES),
});

class CreateAccountDto extends createZodDto(createAccountSchema) {}

const changeAccountRoleSchema = z.object({
  role: z.enum(ACCOUNT_ROLES),
});

class ChangeAccountRoleDto extends createZodDto(changeAccountRoleSchema) {}

/**
 * Operator-only account management (task 6.2): create an account, change its
 * role, or disable it. This is the API surface behind the same write helpers
 * the `create-account` command uses (task 6.1) — the command exists for
 * bootstrapping the first operator before any account can call this API.
 */
@Controller("accounts")
export class AccountsController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * Lists every account (id, email, role — never a password hash), open to
   * any signed-in role rather than `@RequiresRole("operator", ...)`: a
   * viewer needs this too, to resolve who approved, rejected or marked
   * something (task 8.5), not only an operator managing accounts.
   */
  @Get()
  async listAccounts() {
    return listAccounts(this.database);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequiresRole("operator", "Creating an account")
  @UsePipes(new ValidationPipe({ transform: true }))
  async createAccount(@Body() body: CreateAccountDto) {
    const passwordHash = await hashPassword(body.password);

    try {
      return await insertAccount(this.database, {
        email: body.email,
        passwordHash,
        role: body.role,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "WriteValidationError") {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id/role")
  @RequiresRole("operator", "Changing an account's role")
  @UsePipes(new ValidationPipe({ transform: true }))
  async changeRole(@Param("id") accountId: string, @Body() body: ChangeAccountRoleDto) {
    return this.changeRoleOrDisable(accountId, () =>
      changeAccountRole(this.database, accountId, body.role as AccountRole),
    );
  }

  @Post(":id/disable")
  @RequiresRole("operator", "Disabling an account")
  async disable(@Param("id") accountId: string) {
    return this.changeRoleOrDisable(accountId, () => disableAccount(this.database, accountId));
  }

  private async changeRoleOrDisable<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.name === "RecordNotFoundError") {
        throw new NotFoundException(`Account "${accountId}" not found.`);
      }
      throw error;
    }
  }
}
