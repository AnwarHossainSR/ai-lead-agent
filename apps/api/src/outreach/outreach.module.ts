import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";
import { OutreachController } from "./outreach.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [OutreachController],
  providers: [OutreachDraftingService],
})
export class OutreachModule {}
