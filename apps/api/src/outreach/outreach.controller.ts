import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { z } from "zod";
import { createZodDto } from "../validation/zod-dto";
import { OutreachDraftingService } from "./outreach-drafting.service";

const draftOutreachSchema = z.object({
  contactId: z.string().uuid(),
  channelId: z.string().min(1),
});

class DraftOutreachRequestDto extends createZodDto(draftOutreachSchema) {}

const updateOutreachSchema = z.object({
  subject: z.string().trim().min(1).optional(),
  messageBody: z.string().trim().min(1).optional(),
});

class UpdateOutreachRequestDto extends createZodDto(updateOutreachSchema) {}

const rejectOutreachSchema = z.object({
  reason: z.string().trim().min(1),
});

class RejectOutreachRequestDto extends createZodDto(rejectOutreachSchema) {}

@Controller()
export class OutreachController {
  constructor(private readonly outreachDraftingService: OutreachDraftingService) {}

  @Post("leads/:id/outreach/draft")
  @UsePipes(new ValidationPipe({ transform: true }))
  async draftOutreach(
    @Param("id") leadId: string,
    @Body() body: DraftOutreachRequestDto,
  ) {
    return this.outreachDraftingService.draftOutreach({
      leadId,
      contactId: body.contactId,
      channelId: body.channelId,
    });
  }

  @Get("outreach")
  async listOutreach(@Query("status") status?: string) {
    return this.outreachDraftingService.listOutreach({ status });
  }

  @Patch("outreach/:id")
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateOutreach(
    @Param("id") outreachId: string,
    @Body() body: UpdateOutreachRequestDto,
  ) {
    return this.outreachDraftingService.updateOutreach(outreachId, body);
  }

  @Post("outreach/:id/submit")
  async submitOutreach(@Param("id") outreachId: string) {
    return this.outreachDraftingService.submitOutreach(outreachId);
  }

  @Post("outreach/:id/approve")
  async approveOutreach(@Param("id") outreachId: string) {
    return this.outreachDraftingService.approveOutreach(outreachId);
  }

  @Post("outreach/:id/reject")
  @UsePipes(new ValidationPipe({ transform: true }))
  async rejectOutreach(
    @Param("id") outreachId: string,
    @Body() body: RejectOutreachRequestDto,
  ) {
    return this.outreachDraftingService.rejectOutreach(outreachId, body.reason);
  }

  @Post("outreach/:id/cancel")
  async cancelOutreach(@Param("id") outreachId: string) {
    return this.outreachDraftingService.cancelOutreach(outreachId);
  }
}
