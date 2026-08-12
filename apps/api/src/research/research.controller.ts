import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

import { createZodDto } from "../validation/zod-dto";
import { ResearchService } from "./research.service";
import {
  deleteContactsForCompany,
  type Database,
} from "@mela/database";
import { Inject } from "@nestjs/common";
import { DATABASE } from "../database/database.module";
import { eq } from "drizzle-orm";
import { contacts } from "@mela/database";

/**
 * Zod schema for the POST /api/companies/:id/contacts/research request body.
 */
const researchContactsBodySchema = z.object({
  pages: z.array(
    z.object({
      url: z.string().url(),
      html: z.string(),
    }),
  ),
});

/**
 * DTO for the research contacts request body.
 */
export class ResearchContactsDto extends createZodDto(
  researchContactsBodySchema,
) {}

/**
 * The research controller owns the API surface for contact research.
 */
@Controller("companies")
export class ResearchController {
  constructor(
    private readonly researchService: ResearchService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  /**
   * POST /api/companies/:id/contacts/research — run contact research.
   */
  @Post(":id/contacts/research")
  @HttpCode(HttpStatus.ACCEPTED)
  async researchContacts(
    @Param("id") id: string,
    @Body() body: ResearchContactsDto,
  ): Promise<{
    readonly companyId: string;
    readonly status: string;
    readonly message: string;
  }> {
    const result = await this.researchService.researchContacts(id, body.pages);

    return {
      companyId: id,
      status: "accepted",
      message: `Research completed. Found ${result.contactsFound} contacts.`,
    };
  }

  /**
   * GET /api/companies/:id/contacts — list contacts for a company.
   */
  @Get(":id/contacts")
  async listContacts(
    @Param("id") id: string,
  ): Promise<{
    readonly companyId: string;
    readonly contacts: readonly Record<string, unknown>[];
  }> {
    const result = await this.database
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, id));

    return {
      companyId: id,
      contacts: result,
    };
  }

  /**
   * DELETE /api/companies/:id/contacts — delete all contacts for a company.
   */
  @Delete(":id/contacts")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContacts(@Param("id") id: string): Promise<void> {
    await deleteContactsForCompany(this.database, id);
  }
}
