/**
 * The package's write API.
 *
 * Everything that changes data goes through here. The raw Drizzle tables are
 * exported for reads only: an insert straight into a table skips the
 * configuration checks, the evidence schemas and the derived normalization
 * keys (design D4).
 */

export {
  DuplicateCompanyError,
  DuplicateLeadError,
  RecordNotFoundError,
  WriteValidationError,
} from "./errors";

export {
  changeAccountRole,
  disableAccount,
  findAccountByEmailWithHash,
  getAccount,
  insertAccount,
  insertAccountInputSchema,
  listAccounts,
  type InsertAccountInput,
  type PublicAccountRow,
} from "./accounts";

export {
  findSessionByTokenHash,
  insertSession,
  insertSessionInputSchema,
  revokeAllSessionsForAccount,
  revokeSession,
  touchSession,
  type InsertSessionInput,
} from "./sessions";

export {
  insertAuditEntry,
  insertAuditEntryInputSchema,
  listAuditEntries,
  type AuditLogFilters,
  type InsertAuditEntryInput,
} from "./audit-log";

export {
  applyVerificationResult,
  applyVerificationResultInputSchema,
  clearCompanyDoNotContact,
  deriveVerificationState,
  findCompanyByNormalizedDomain,
  findCompanyByNormalizedName,
  insertCompany,
  insertCompanyInputSchema,
  listStaleCompanies,
  setCompanyDoNotContact,
  setCompanyDoNotContactInputSchema,
  updateCompany,
  updateCompanyInputSchema,
  type ApplyVerificationResultInput,
  type InsertCompanyInput,
  type SetCompanyDoNotContactInput,
  type UpdateCompanyInput,
  type VerificationCheckResult,
} from "./companies";

export {
  clearContactDoNotContact,
  deleteContactsForCompany,
  getLatestContacts,
  insertContact,
  insertContactInputSchema,
  setContactDoNotContact,
  setContactDoNotContactInputSchema,
  type InsertContactInput,
  type SetContactDoNotContactInput,
} from "./contacts";

export {
  getLatestContactResearchRuns,
  insertContactResearchRun,
  insertContactResearchRunInputSchema,
  type InsertContactResearchRunInput,
} from "./contact-research-runs";

export {
  getLatestWebsiteAnalysis,
  insertWebsiteAnalysis,
  insertWebsiteAnalysisInputSchema,
  type InsertWebsiteAnalysisInput,
} from "./website-analysis";

export {
  countCompaniesByTechnology,
  getLatestDetections,
  insertTechnologyDetection,
  insertTechnologyDetectionInputSchema,
  type InsertTechnologyDetectionInput,
} from "./technology-detections";

export {
  applyLeadStatusChange,
  insertLead,
  insertLeadInputSchema,
  type InsertLeadInput,
} from "./leads";

export {
  compareSnapshots,
  insertLeadScoreSnapshot,
  listStaleLeads,
  updateLeadScore,
  updateLeadScoreInputSchema,
  type LeadScoreSnapshotWithDiff,
  type UpdateLeadScoreInput,
} from "./scoring";

export {
  getCurrentLeadResearchSummary,
  getLeadResearchSummaryHistory,
  insertLeadResearchSummary,
  insertLeadResearchSummaryInputSchema,
  type InsertLeadResearchSummaryInput,
} from "./lead-research-summaries";

export {
  approveOutreach,
  cancelOutreach,
  countOutreach,
  getOutreach,
  insertOutreachDraft,
  insertOutreachInputSchema,
  insertOutreachResponse,
  insertOutreachResponseInputSchema,
  listOutreach,
  markOutreachSent,
  recordOutreachResponse,
  recordOutreachSend,
  recordOutreachSendInputSchema,
  rejectOutreach,
  submitOutreachForApproval,
  updateOutreachText,
  type InsertOutreachInput,
  type InsertOutreachResponseInput,
  type ListOutreachFilters,
  type OutreachClaim,
  type OutreachCitation,
  type OutreachFilters,
  type RecordOutreachSendInput,
} from "./outreach";

export {
  recordDependencyHealthSample,
  recordDependencyHealthSampleInputSchema,
  type RecordDependencyHealthSampleInput,
} from "./dependency-health";

export {
  insertAIInvocation,
  insertAIInvocationInputSchema,
  spendInWindow,
  type InsertAIInvocationInput,
} from "./ai-invocations";

export {
  finishDiscoveryRun,
  finishDiscoveryRunInputSchema,
  recordCompanyDiscoverySource,
  recordCompanyDiscoverySourceInputSchema,
  recordDiscoveryRunSource,
  recordDiscoveryRunSourceInputSchema,
  startDiscoveryRun,
  startDiscoveryRunInputSchema,
  type FinishDiscoveryRunInput,
  type RecordCompanyDiscoverySourceInput,
  type RecordDiscoveryRunSourceInput,
  type StartDiscoveryRunInput,
} from "./discovery-runs";

export {
  insertOpportunityAnalysisRun,
  insertOpportunityAnalysisRunInputSchema,
  type InsertOpportunityAnalysisRunInput,
} from "./opportunity-analysis-runs";

export {
  insertOpportunity,
  insertOpportunityInputSchema,
  type InsertOpportunityInput,
} from "./opportunities";

export {
  getCurrentOpportunities,
  getLatestOpportunities,
  getRunHistory,
} from "./opportunity-read-helpers";

export {
  assertEvidenceForScoring,
  gatherCompanyEvidence,
  identifyEvidence,
  NoEvidenceForScoringError,
  type CompanyEvidence,
  type CompanyEvidenceIdentifiers,
} from "./company-evidence";
