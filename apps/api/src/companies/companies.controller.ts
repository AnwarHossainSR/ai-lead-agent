import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";

import { COMPANY_VERIFICATION_STATES, type CompanyVerificationState } from "@mela/database";
import { z } from "zod";
import { createZodDto } from "../validation/zod-dto";
import { CompaniesService } from "./companies.service";

const companyFiltersSchema = z.object({
  verificationState: z
    .enum([...COMPANY_VERIFICATION_STATES] as [
      CompanyVerificationState,
      ...CompanyVerificationState[],
    ])
    .optional(),
  countryId: z.string().min(1).optional(),
  cityId: z.string().min(1).optional(),
  industryId: z.string().min(1).optional(),
});

const listCompaniesQuerySchema = companyFiltersSchema.extend({
  order: z.enum(["created_desc", "name_asc"]).default("created_desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

class ListCompaniesQueryDto extends createZodDto(listCompaniesQuerySchema) {}
class CountCompaniesQueryDto extends createZodDto(companyFiltersSchema) {}

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

  @Get("count")
  async countCompanies(@Query() query: CountCompaniesQueryDto) {
    const value = await this.companiesService.countCompanies(query);
    return { count: value };
  }

  // Registered before ":id": a route parameter registered earlier would
  // swallow this literal path segment as an :id.
  @Get("needs-attention")
  async getNeedsAttention() {
    return this.companiesService.getNeedsAttention();
  }

  // Registered after "count": a route parameter registered earlier would
  // swallow that literal path segment as an :id.
  @Get(":id")
  async getCompany(@Param("id") id: string) {
    const company = await this.companiesService.getCompany(id);

    if (company === null) {
      throw new NotFoundException(`Company "${id}" not found.`);
    }

    return company;
  }

  @Get(":id/opportunities")
  async listOpportunities(@Param("id") id: string) {
    return this.companiesService.listOpportunities(id);
  }
}
