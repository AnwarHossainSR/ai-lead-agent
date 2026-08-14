import { Module } from "@nestjs/common";

import { AccountsModule } from "./accounts/accounts.module";
import { AIModule } from "./ai/ai.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CompaniesModule } from "./companies/companies.module";
import { EnvModule } from "./config/env.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { HealthModule } from "./health/health.module";
import { OperationsModule } from "./operations/operations.module";
import { OpportunityModule } from "./opportunity/opportunity.module";
import { OutreachModule } from "./outreach/outreach.module";
import { RedisModule } from "./redis/redis.module";
import { ResearchSummaryModule } from "./research-summary/research-summary.module";
import { ScoringModule } from "./scoring/scoring.module";
import { SearchModule } from "./search/search.module";
import { VerificationModule } from "./verification/verification.module";

/**
 * The application shell. Four modules, no domain behaviour: this change
 * establishes that the API starts, reaches its dependencies and reports on
 * them. Discovery, research, scoring and outreach arrive as their own modules
 * in later phases.
 */
@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    AccountsModule,
    RedisModule,
    HealthModule,
    AIModule,
    DiscoveryModule,
    VerificationModule,
    AnalysisModule,
    CompaniesModule,
    OpportunityModule,
    ScoringModule,
    OutreachModule,
    AnalyticsModule,
    ResearchSummaryModule,
    OperationsModule,
    DashboardModule,
    SearchModule,
  ],
})
export class AppModule {}
