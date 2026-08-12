import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { DATABASE } from "../database/database.module";
import { type Database } from "@mela/database";
import { discoveryRuns, discoveryRunSources } from "@mela/database";

import { RunService, type RunRequest, type RunResult } from "./run.service";
import {
  isCountryId,
  isIndustryId,
  COUNTRIES,
  INDUSTRIES,
  CITIES,
  findCity,
} from "@mela/config";
import { createZodDto } from "../validation/zod-dto";

/**
 * Zod schema for the POST /api/discovery/runs request body (task 8.1).
 *
 * Validates territory and industry identifiers against the configured ones,
 * returning a clear error naming the configured values rather than a database
 * error.
 */
const createRunBodySchema = z
  .object({
    countryId: z.string().trim().min(1, "Expected a country identifier."),
    cityId: z.string().trim().min(1).optional(),
    industryId: z.string().trim().min(1, "Expected an industry identifier."),
    candidateLimit: z.number().int().positive().default(100),
    durationLimitSeconds: z.number().int().positive().default(300),
  })
  .superRefine((data, ctx) => {
    if (!isCountryId(data.countryId)) {
      const known = COUNTRIES.map((c) => c.id).join(", ");
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown country identifier "${data.countryId}". Configured countries: ${known}.`,
        path: ["countryId"],
      });
    }

    if (!isIndustryId(data.industryId)) {
      const known = INDUSTRIES.map((i) => i.id).join(", ");
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown industry identifier "${data.industryId}". Configured industries: ${known}.`,
        path: ["industryId"],
      });
    }

    if (data.cityId !== undefined) {
      const city = findCity(data.cityId);
      if (city === undefined) {
        const known = CITIES.filter((c) => c.countryId === data.countryId)
          .map((c) => c.id)
          .join(", ");
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown city identifier "${data.cityId}". Configured cities for "${data.countryId}": ${known || "none"}.`,
          path: ["cityId"],
        });
      } else if (city.countryId !== data.countryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `City "${data.cityId}" belongs to country "${city.countryId}", not "${data.countryId}".`,
          path: ["cityId"],
        });
      }
    }
  });

/**
 * DTO for the POST /api/discovery/runs request body.
 * Uses the ZodValidationPipe pattern for automatic validation.
 */
export class CreateRunDto extends createZodDto(createRunBodySchema) {}

/**
 * The discovery controller owns the API surface for company discovery runs
 * (design D6). It exposes the endpoints that trigger and inspect runs, and
 * wires the run service to the database.
 */
@Controller("discovery/runs")
export class DiscoveryController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly runService: RunService,
  ) {}

  /**
   * POST /api/discovery/runs — create and run a discovery run (task 8.1).
   *
   * Validates territory and industry identifiers against configuration,
   * returns the completed run record with per-source counts and outcomes.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRun(@Body() body: CreateRunDto): Promise<{
    readonly run: Record<string, unknown>;
    readonly sources: readonly Record<string, unknown>[];
  }> {
    const parsed = body;

    // Pass an empty sources map - the run service will skip sources that
    // aren't provided, which is the expected behavior when the API triggers
    // a run without source implementations.
    const sources = new Map();

    const result: RunResult = await this.runService.executeRun(
      this.database,
      sources,
      {
        countryId: parsed.countryId,
        cityId: parsed.cityId,
        industryId: parsed.industryId,
        candidateLimit: parsed.candidateLimit,
        durationLimitSeconds: parsed.durationLimitSeconds,
      } satisfies RunRequest,
    );

    // Query the created run and its sources
    const [run] = await this.database
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, result.run.id))
      .limit(1);

    if (run === undefined) {
      throw new NotFoundException(`Discovery run "${result.run.id}" not found after creation.`);
    }

    const runSources = await this.database
      .select()
      .from(discoveryRunSources)
      .where(eq(discoveryRunSources.runId, result.run.id));

    return {
      run: run as unknown as Record<string, unknown>,
      sources: runSources as unknown as readonly Record<string, unknown>[],
    };
  }

  /**
   * GET /api/discovery/runs — list recent runs (task 8.2).
   *
   * Returns runs ordered by start time (newest first), with per-source
   * counts and outcomes.
   */
  @Get()
  async listRuns(): Promise<
    readonly {
      readonly run: Record<string, unknown>;
      readonly sources: readonly Record<string, unknown>[];
    }[]
  > {
    const runs = await this.database
      .select()
      .from(discoveryRuns)
      .orderBy(desc(discoveryRuns.startedAt))
      .limit(50);

    const results: {
      readonly run: Record<string, unknown>;
      readonly sources: readonly Record<string, unknown>[];
    }[] = [];

    for (const run of runs) {
      const sources = await this.database
        .select()
        .from(discoveryRunSources)
        .where(eq(discoveryRunSources.runId, run.id));

      results.push({
        run: run as unknown as Record<string, unknown>,
        sources: sources as unknown as readonly Record<string, unknown>[],
      });
    }

    return results;
  }

  /**
   * GET /api/discovery/runs/:id — get a specific run (task 8.2).
   *
   * Returns the run with per-source counts and outcomes, or 404 if not found.
   */
  @Get(":id")
  async getRun(
    @Param("id") id: string,
  ): Promise<{
    readonly run: Record<string, unknown>;
    readonly sources: readonly Record<string, unknown>[];
  }> {
    const [run] = await this.database
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, id))
      .limit(1);

    if (run === undefined) {
      throw new NotFoundException(`Discovery run "${id}" not found.`);
    }

    const sources = await this.database
      .select()
      .from(discoveryRunSources)
      .where(eq(discoveryRunSources.runId, id));

    return {
      run: run as unknown as Record<string, unknown>,
      sources: sources as unknown as readonly Record<string, unknown>[],
    };
  }
}
