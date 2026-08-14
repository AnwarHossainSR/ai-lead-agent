import { type Database, type SearchResults, searchWorkspace } from "@mela/database";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";

import { DATABASE } from "../database/database.module";
import { type InferDto, createZodDto } from "../validation/zod-dto";

const searchQuerySchema = z.object({
  // Bounded above so a pasted document is not turned into a `LIKE` scan, and
  // allowed to be empty so the palette's first keystroke does not 400.
  q: z.string().trim().max(120).default(""),
});

const SearchQueryDto = createZodDto(searchQuerySchema);
type SearchQueryDto = InferDto<typeof SearchQueryDto>;

/**
 * Companies and leads by name or domain, for the command palette.
 *
 * A read open to any signed-in role. It returns only what the list views
 * already show — a name, a domain, a score and a status — so the palette
 * cannot become a way to see something the reader could not otherwise reach.
 */
@Controller("search")
export class SearchController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get()
  async search(@Query() query: SearchQueryDto): Promise<SearchResults> {
    return searchWorkspace(this.database, query.q);
  }
}
