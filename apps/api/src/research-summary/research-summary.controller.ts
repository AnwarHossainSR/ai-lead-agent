import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";

import { z } from "zod";
import { RequiresRole } from "../auth/requires-role.decorator";
import { createZodDto } from "../validation/zod-dto";
import { ResearchSummaryService } from "./research-summary.service";

const generateSummarySchema = z.object({});

class GenerateSummaryRequestDto extends createZodDto(generateSummarySchema) {}

@Controller()
export class ResearchSummaryController {
  constructor(private readonly researchSummaryService: ResearchSummaryService) {}

  @Post("leads/:id/research-summary")
  @RequiresRole("operator", "Generating a research summary")
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateSummary(@Param("id") leadId: string, @Body() _body: GenerateSummaryRequestDto) {
    return this.researchSummaryService.generateSummary({ leadId });
  }

  // Wrapped in an object rather than returned bare: Nest treats a handler
  // returning `null` or `undefined` the same way — an empty body — so a
  // JSON-parsing client couldn't tell "no summary yet" (design D4, a real
  // state) apart from a broken response. An object is never nil.
  @Get("leads/:id/research-summary")
  async getCurrentSummary(@Param("id") leadId: string) {
    const summary = await this.researchSummaryService.getCurrentSummary(leadId);
    return { summary: summary ?? null };
  }
}
