import { Controller, Get, Query } from "@nestjs/common";

import { COMPANY_VERIFICATION_STATES, type CompanyVerificationState } from "@mela/database";
import { z } from "zod";
import { createZodDto } from "../validation/zod-dto";
import { CompaniesService } from "./companies.service";

const listCompaniesQuerySchema = z.object({
  verificationState: z
    .enum(COMPANY_VERIFICATION_STATES as [CompanyVerificationState, ...CompanyVerificationState[]])
    .optional(),
  countryId: z.string().min(1).optional(),
  cityId: z.string().min(1).optional(),
  industryId: z.string().min(1).optional(),
  order: z.enum(["created_desc", "name_asc"]).default("created_desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

class ListCompaniesQueryDto extends createZodDto(listCompaniesQuerySchema) {}

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async listCompanies(@Query() query: ListCompaniesQueryDto) {
    return this.companiesService.listCompanies({
      verificationState: query.verificationState,
      countryId: query.countryId,
      cityId: query.cityId,
      industryId: query.industryId,
      order: query.order,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
