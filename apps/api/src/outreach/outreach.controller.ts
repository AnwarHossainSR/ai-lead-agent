import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { OUTREACH_STATUSES, type OutreachStatus, type PublicAccountRow } from "@mela/database";
import { z } from "zod";
import { CurrentAccount } from "../auth/current-account.decorator";
import { RequiresRole } from "../auth/requires-role.decorator";
import { createZodDto } from "../validation/zod-dto";
import { OutreachDraftingService } from "./outreach-drafting.service";

const draftOutreachSchema = z.object({
  contactId: z.string().uuid(),
  channelId: z.string().min(1),
});

class DraftOutreachRequestDto extends createZodDto(draftOutreachSchema) {}

const outreachFiltersSchema = z.object({
  status: z.enum([...OUTREACH_STATUSES] as [OutreachStatus, ...OutreachStatus[]]).optional(),
  sentAfter: z.coerce.date().optional(),
});

const listOutreachQuerySchema = outreachFiltersSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

class ListOutreachQueryDto extends createZodDto(listOutreachQuerySchema) {}
class CountOutreachQueryDto extends createZodDto(outreachFiltersSchema) {}

const updateOutreachSchema = z.object({
  subject: z.string().trim().min(1).optional(),
  messageBody: z.string().trim().min(1).optional(),
});

class UpdateOutreachRequestDto extends createZodDto(updateOutreachSchema) {}

const rejectOutreachSchema = z.object({
  reason: z.string().trim().min(1),
});

class RejectOutreachRequestDto extends createZodDto(rejectOutreachSchema) {}

const recordOutreachSentSchema = z.object({
  sentAt: z.coerce.date(),
  means: z.string().trim().min(1, "Expected the send means."),
});

class RecordOutreachSentDto extends createZodDto(recordOutreachSentSchema) {}

const classifyResponseSchema = z.object({
  replyText: z.string().trim().min(1, "Expected the reply text."),
});

class ClassifyResponseDto extends createZodDto(classifyResponseSchema) {}

const recordResponseSchema = z.object({
  categoryId: z.string().trim().min(1, "Expected the category identifier."),
  receivedAt: z.coerce.date(),
  body: z.string().trim().min(1).optional(),
  proposedCategoryId: z.string().trim().min(1).optional(),
  aiInvocationId: z.string().uuid().optional(),
});

class RecordResponseDto extends createZodDto(recordResponseSchema) {}

const recordNoResponseSchema = z.object({
  receivedAt: z.coerce.date(),
});

class RecordNoResponseDto extends createZodDto(recordNoResponseSchema) {}

const setCompanyDoNotContactSchema = z.object({
  reason: z.string().trim().min(1, "Expected the reason."),
});

class SetCompanyDoNotContactDto extends createZodDto(setCompanyDoNotContactSchema) {}

const setContactDoNotContactSchema = z.object({
  reason: z.string().trim().min(1, "Expected the reason."),
});

class SetContactDoNotContactDto extends createZodDto(setContactDoNotContactSchema) {}

@Controller()
export class OutreachController {
  constructor(private readonly outreachDraftingService: OutreachDraftingService) {}

  @Post("leads/:id/outreach/draft")
  @RequiresRole("operator", "Drafting outreach")
  @UsePipes(new ValidationPipe({ transform: true }))
  async draftOutreach(@Param("id") leadId: string, @Body() body: DraftOutreachRequestDto) {
    return this.outreachDraftingService.draftOutreach({
      leadId,
      contactId: body.contactId,
      channelId: body.channelId,
    });
  }

  @Get("outreach")
  async listOutreach(@Query() query: ListOutreachQueryDto) {
    return this.outreachDraftingService.listOutreach({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("outreach/count")
  async countOutreach(@Query() query: CountOutreachQueryDto) {
    const value = await this.outreachDraftingService.countOutreach({
      status: query.status,
      sentAfter: query.sentAfter,
    });
    return { count: value };
  }

  // Registered after "outreach/count": a route parameter registered earlier
  // would swallow that literal path segment as an :id.
  @Get("outreach/:id")
  async getOutreach(@Param("id") outreachId: string) {
    const record = await this.outreachDraftingService.getOutreach(outreachId);

    if (record === undefined) {
      throw new NotFoundException(`Outreach "${outreachId}" not found.`);
    }

    return record;
  }

  @Patch("outreach/:id")
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateOutreach(@Param("id") outreachId: string, @Body() body: UpdateOutreachRequestDto) {
    return this.outreachDraftingService.updateOutreach(outreachId, body);
  }

  @Post("outreach/:id/submit")
  async submitOutreach(@Param("id") outreachId: string) {
    return this.outreachDraftingService.submitOutreach(outreachId);
  }

  @Post("outreach/:id/approve")
  @RequiresRole("operator", "Approving outreach")
  async approveOutreach(
    @Param("id") outreachId: string,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    return this.outreachDraftingService.approveOutreach(outreachId, account.id);
  }

  @Post("outreach/:id/reject")
  @RequiresRole("operator", "Rejecting outreach")
  @UsePipes(new ValidationPipe({ transform: true }))
  async rejectOutreach(
    @Param("id") outreachId: string,
    @Body() body: RejectOutreachRequestDto,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    return this.outreachDraftingService.rejectOutreach(outreachId, body.reason, account.id);
  }

  @Post("outreach/:id/sent")
  @RequiresRole("operator", "Recording outreach as sent")
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordOutreachSent(
    @Param("id") outreachId: string,
    @Body() body: RecordOutreachSentDto,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    try {
      return this.outreachDraftingService.recordOutreachSent(outreachId, body, account.id);
    } catch (error) {
      if (error instanceof Error && error.name === "WriteValidationError") {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post("outreach/:id/responses/classify")
  @RequiresRole("operator", "Classifying an outreach response")
  async classifyResponse(@Param("id") outreachId: string, @Body() body: ClassifyResponseDto) {
    try {
      return this.outreachDraftingService.classifyResponse(outreachId, body.replyText);
    } catch (error) {
      if (error instanceof Error && error.name === "WriteValidationError") {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post("outreach/:id/responses")
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordResponse(
    @Param("id") outreachId: string,
    @Body() body: RecordResponseDto,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    try {
      return this.outreachDraftingService.recordResponse(
        outreachId,
        {
          categoryId: body.categoryId,
          receivedAt: body.receivedAt,
          body: body.body,
          proposedCategoryId: body.proposedCategoryId,
          aiInvocationId: body.aiInvocationId,
        },
        account.id,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "WriteValidationError") {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post("outreach/:id/no-response")
  @UsePipes(new ValidationPipe({ transform: true }))
  async recordNoResponse(@Param("id") outreachId: string, @Body() body: RecordNoResponseDto) {
    try {
      return this.outreachDraftingService.recordNoResponse(outreachId, body.receivedAt);
    } catch (error) {
      if (error instanceof Error && error.name === "WriteValidationError") {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post("outreach/:id/cancel")
  async cancelOutreach(@Param("id") outreachId: string) {
    return this.outreachDraftingService.cancelOutreach(outreachId);
  }

  @Post("companies/:id/do-not-contact")
  @RequiresRole("operator", "Marking a company do-not-contact")
  @UsePipes(new ValidationPipe({ transform: true }))
  async setCompanyDoNotContact(
    @Param("id") companyId: string,
    @Body() body: SetCompanyDoNotContactDto,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    return this.outreachDraftingService.setCompanyDoNotContact(companyId, body.reason, account.id);
  }

  @Post("companies/:id/clear-do-not-contact")
  @RequiresRole("operator", "Clearing a company's do-not-contact marker")
  async clearCompanyDoNotContact(@Param("id") companyId: string) {
    return this.outreachDraftingService.clearCompanyDoNotContact(companyId);
  }

  @Post("contacts/:id/do-not-contact")
  @RequiresRole("operator", "Marking a contact do-not-contact")
  @UsePipes(new ValidationPipe({ transform: true }))
  async setContactDoNotContact(
    @Param("id") contactId: string,
    @Body() body: SetContactDoNotContactDto,
    @CurrentAccount() account: PublicAccountRow,
  ) {
    return this.outreachDraftingService.setContactDoNotContact(contactId, body.reason, account.id);
  }

  @Post("contacts/:id/clear-do-not-contact")
  @RequiresRole("operator", "Clearing a contact's do-not-contact marker")
  async clearContactDoNotContact(@Param("id") contactId: string) {
    return this.outreachDraftingService.clearContactDoNotContact(contactId);
  }
}
