import { z } from "zod";

import { QUEUE_CONFIGS, type QueueConfig } from "@mela/config";

const baseJobPayloadSchema = z.object({
  force: z.boolean().default(false),
});

export type BaseJobPayload = z.infer<typeof baseJobPayloadSchema>;

export const discoveryJobPayloadSchema = baseJobPayloadSchema.extend({
  countryId: z.string().min(1),
  cityId: z.string().optional(),
  industryId: z.string().min(1),
  candidateLimit: z.number().int().positive(),
  durationLimitSeconds: z.number().int().positive(),
});

export type DiscoveryJobPayload = z.infer<typeof discoveryJobPayloadSchema>;

export const verificationJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
});

export type VerificationJobPayload = z.infer<typeof verificationJobPayloadSchema>;

export const websiteAnalysisJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
  unverifiedOverride: z.boolean().default(false),
});

export type WebsiteAnalysisJobPayload = z.infer<typeof websiteAnalysisJobPayloadSchema>;

export const technologyDetectionJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
});

export type TechnologyDetectionJobPayload = z.infer<typeof technologyDetectionJobPayloadSchema>;

export const opportunityAnalysisJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
});

export type OpportunityAnalysisJobPayload = z.infer<typeof opportunityAnalysisJobPayloadSchema>;

export const contactResearchJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
});

export type ContactResearchJobPayload = z.infer<typeof contactResearchJobPayloadSchema>;

export const scoringJobPayloadSchema = baseJobPayloadSchema.extend({
  companyId: z.string().min(1),
  weightVersion: z.number().int().positive(),
});

export type ScoringJobPayload = z.infer<typeof scoringJobPayloadSchema>;

export const researchSummaryJobPayloadSchema = baseJobPayloadSchema.extend({
  leadId: z.string().min(1),
});

export type ResearchSummaryJobPayload = z.infer<typeof researchSummaryJobPayloadSchema>;

export const replyClassificationJobPayloadSchema = baseJobPayloadSchema.extend({
  outreachId: z.string().min(1),
  replyText: z.string().min(1),
});

export type ReplyClassificationJobPayload = z.infer<typeof replyClassificationJobPayloadSchema>;

export type JobPayloadMap = {
  discovery: DiscoveryJobPayload;
  verification: VerificationJobPayload;
  "website-analysis": WebsiteAnalysisJobPayload;
  "technology-detection": TechnologyDetectionJobPayload;
  "opportunity-analysis": OpportunityAnalysisJobPayload;
  "contact-research": ContactResearchJobPayload;
  scoring: ScoringJobPayload;
  "research-summary": ResearchSummaryJobPayload;
  "reply-classification": ReplyClassificationJobPayload;
};

export type JobName = keyof JobPayloadMap;

export type JobPayload<T extends JobName> = JobPayloadMap[T];

export interface JobDefinition<T extends JobName = JobName> {
  readonly name: T;
  readonly queueName: T;
  readonly queueConfig: QueueConfig;
  readonly payloadSchema: z.ZodType<JobPayload<T>>;
  readonly getSubjectId: (payload: unknown) => string;
}

export const JOB_DEFINITIONS: readonly JobDefinition[] = [
  {
    name: "discovery",
    queueName: "discovery",
    queueConfig: QUEUE_CONFIGS.discovery as QueueConfig,
    payloadSchema: discoveryJobPayloadSchema,
    getSubjectId: (payload) =>
      `${(payload as DiscoveryJobPayload).countryId}:${(payload as DiscoveryJobPayload).industryId}`,
  },
  {
    name: "verification",
    queueName: "verification",
    queueConfig: QUEUE_CONFIGS.verification as QueueConfig,
    payloadSchema: verificationJobPayloadSchema,
    getSubjectId: (payload) => (payload as VerificationJobPayload).companyId,
  },
  {
    name: "website-analysis",
    queueName: "website-analysis",
    queueConfig: QUEUE_CONFIGS["website-analysis"] as QueueConfig,
    payloadSchema: websiteAnalysisJobPayloadSchema,
    getSubjectId: (payload) => (payload as WebsiteAnalysisJobPayload).companyId,
  },
  {
    name: "technology-detection",
    queueName: "technology-detection",
    queueConfig: QUEUE_CONFIGS["technology-detection"] as QueueConfig,
    payloadSchema: technologyDetectionJobPayloadSchema,
    getSubjectId: (payload) => (payload as TechnologyDetectionJobPayload).companyId,
  },
  {
    name: "opportunity-analysis",
    queueName: "opportunity-analysis",
    queueConfig: QUEUE_CONFIGS["opportunity-analysis"] as QueueConfig,
    payloadSchema: opportunityAnalysisJobPayloadSchema,
    getSubjectId: (payload) => (payload as OpportunityAnalysisJobPayload).companyId,
  },
  {
    name: "contact-research",
    queueName: "contact-research",
    queueConfig: QUEUE_CONFIGS["contact-research"] as QueueConfig,
    payloadSchema: contactResearchJobPayloadSchema,
    getSubjectId: (payload) => (payload as ContactResearchJobPayload).companyId,
  },
  {
    name: "scoring",
    queueName: "scoring",
    queueConfig: QUEUE_CONFIGS.scoring as QueueConfig,
    payloadSchema: scoringJobPayloadSchema,
    getSubjectId: (payload) => (payload as ScoringJobPayload).companyId,
  },
  {
    name: "research-summary",
    queueName: "research-summary",
    queueConfig: QUEUE_CONFIGS["research-summary"] as QueueConfig,
    payloadSchema: researchSummaryJobPayloadSchema,
    getSubjectId: (payload) => (payload as ResearchSummaryJobPayload).leadId,
  },
  {
    name: "reply-classification",
    queueName: "reply-classification",
    queueConfig: QUEUE_CONFIGS["reply-classification"] as QueueConfig,
    payloadSchema: replyClassificationJobPayloadSchema,
    getSubjectId: (payload) => (payload as ReplyClassificationJobPayload).outreachId,
  },
] as const;

export function findJobDefinition(name: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((job) => job.name === name);
}

export function resolveJobDefinition(name: string): JobDefinition {
  const definition = findJobDefinition(name);

  if (definition === undefined) {
    const known = JOB_DEFINITIONS.map((job) => job.name).join(", ");
    throw new Error(`Unknown job type "${name}". Configured job types: ${known}.`);
  }

  return definition;
}
