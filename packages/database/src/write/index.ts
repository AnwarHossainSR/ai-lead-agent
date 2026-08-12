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
  applyVerificationResult,
  applyVerificationResultInputSchema,
  deriveVerificationState,
  findCompanyByNormalizedDomain,
  findCompanyByNormalizedName,
  insertCompany,
  insertCompanyInputSchema,
  listStaleCompanies,
  updateCompany,
  updateCompanyInputSchema,
  type ApplyVerificationResultInput,
  type InsertCompanyInput,
  type UpdateCompanyInput,
  type VerificationCheckResult,
} from "./companies";

export { deleteContactsForCompany, insertContact, insertContactInputSchema, type InsertContactInput } from "./contacts";

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
  approveOutreach,
  cancelOutreach,
  insertOutreachDraft,
  insertOutreachInputSchema,
  markOutreachSent,
  recordOutreachResponse,
  submitOutreachForApproval,
  type InsertOutreachInput,
} from "./outreach";

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
