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
  findCompanyByNormalizedDomain,
  insertCompany,
  insertCompanyInputSchema,
  updateCompany,
  updateCompanyInputSchema,
  type InsertCompanyInput,
  type UpdateCompanyInput,
} from "./companies";

export { insertContact, insertContactInputSchema, type InsertContactInput } from "./contacts";

export {
  getLatestWebsiteAnalysis,
  insertWebsiteAnalysis,
  insertWebsiteAnalysisInputSchema,
  type InsertWebsiteAnalysisInput,
} from "./website-analysis";

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
