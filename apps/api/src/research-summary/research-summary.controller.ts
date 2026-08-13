import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from "@nestjs/common";

import { z } from "zod";
import { createZodDto } from "../validation/zod-dto";
import { ResearchSummaryService } from "./research-summary.service";

const generateSummarySchema = z.object({});

class GenerateSummaryRequestDto extends createZodDto(generateSummarySchema) {}

@Controller()
export class ResearchSummaryController {
  constructor(private readonly researchSummaryService: ResearchSummaryService) {}

  @Post("leads/:id/research-summary")
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateSummary(@Param("id") leadId: string, @Body() _body: GenerateSummaryRequestDto) {
    return this.researchSummaryService.generateSummary({ leadId });
  }

  @Get("leads/:id/research-summary")
  async getCurrentSummary(@Param("id") leadId: string) {
    return this.researchSummaryService.getCurrentSummary(leadId);
  }
}
