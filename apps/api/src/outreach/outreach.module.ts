import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { OutreachController } from "./outreach.controller";
import { OutreachDraftingService } from "./outreach-drafting.service";

@Module({
  imports: [DatabaseModule],
  controllers: [OutreachController],
  providers: [OutreachDraftingService],
})
export class OutreachModule {}
