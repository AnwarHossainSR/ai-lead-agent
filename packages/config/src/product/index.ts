export {
  ACTIVE_CITIES,
  ACTIVE_COUNTRIES,
  CITIES,
  COUNTRIES,
  MARKETS,
  citySchema,
  countrySchema,
  findCity,
  findCountry,
  isCityId,
  isCountryId,
  parseMarkets,
  type City,
  type CityId,
  type Country,
  type CountryId,
  type Markets,
} from "./markets";

export {
  ACTIVE_INDUSTRIES,
  INDUSTRIES,
  findIndustry,
  industrySchema,
  isIndustryId,
  parseIndustries,
  type Industry,
  type IndustryId,
} from "./industries";

export {
  SERVICES,
  findService,
  isServiceId,
  parseServices,
  resolveService,
  serviceSchema,
  type Service,
  type ServiceId,
} from "./services";

export {
  CATEGORIES,
  findCategory,
  resolveOpportunityCategory,
  isOpportunityCategoryId,
  parseCategories,
  categorySchema,
  type Category,
  type CategoryId,
} from "./services";

export {
  INITIAL_LEAD_STATUS,
  LEAD_STATUSES,
  LIFECYCLE,
  LeadStatusTransitionError,
  TERMINAL_LEAD_STATUSES,
  assertTransition,
  canTransition,
  isLeadStatus,
  leadStatusSchema,
  lifecycleSchema,
  parseLifecycle,
  permittedTransitions,
  type LeadStatus,
  type Lifecycle,
  type TerminalLeadStatus,
} from "./lead-lifecycle";

export {
  LEAD_PRIORITIES,
  MAXIMUM_LEAD_SCORE,
  MINIMUM_LEAD_SCORE,
  PRIORITY_BANDS,
  classifyPriority,
  findPriorityBand,
  parsePriorityBands,
  priorityBandSchema,
  type LeadPriority,
  type PriorityBand,
} from "./lead-priority";

export {
  SCORE_COMPONENTS,
  findScoreComponent,
  parseScoreComponents,
  resolveScoreComponent,
  scoreComponentSchema,
  type ScoreComponent,
  type ScoreComponentId,
  type ComponentRules,
  type ConfiguredTechnologyId,
  type BusinessFitProfile,
  type ScoreThreshold,
  type WeightVersion,
  CONFIGURED_TECHNOLOGIES,
  DEFAULT_BUSINESS_FIT_PROFILE,
  DEFAULT_COMPONENT_RULES,
  DEFAULT_WEIGHT_VERSION,
  computeFingerprint,
  getComponentRules,
  parseBusinessFitProfile,
  parseComponentRules,
  parseWeightVersion,
  validateComponentRules,
  validateWeightVersion,
} from "./lead-scoring";

export {
  OUTREACH_CHANNELS,
  automatedSendingIsForbiddenEverywhere,
  findOutreachChannel,
  outreachChannelSchema,
  parseOutreachChannels,
  resolveOutreachChannel,
  type OutreachChannel,
  type OutreachChannelId,
} from "./outreach";

export {
  ACTIVE_DISCOVERY_SOURCES,
  DISCOVERY_SOURCES,
  discoverySourceKindSchema,
  discoverySourceSchema,
  findDiscoverySource,
  isDiscoverySourceId,
  parseDiscoverySources,
  resolveDiscoverySource,
  type DiscoverySource,
  type DiscoverySourceId,
  type DiscoverySourceKind,
} from "./discovery-sources";

export {
  AI_MODEL_TIERS,
  aiModelTierSchema,
  findAIModelTier,
  parseAIModelTiers,
  resolveAIModelTier,
  type AIModelTier,
  type AIModelTierId,
} from "./ai-model-tiers";

export {
  REGISTRY_CONFIGS,
  VERIFICATION_POLITENESS,
  VERIFICATION_RULE,
  isVerificationCheckId,
  parseRegistryConfigs,
  parseVerificationPoliteness,
  parseVerificationRule,
  registryConfigSchema,
  validateRegistryRequirement,
  verificationCheckConfigSchema,
  verificationPolitenessSchema,
  verificationRuleSchema,
  type RegistryConfig,
  type VerificationCheckConfig,
  type VerificationCheckId,
  type VerificationPoliteness,
  type VerificationRule,
} from "./verification";

export {
  ANALYSIS_CONFIG,
  analysisConfigSchema,
  observationRuleSchema,
  parseAnalysisConfig,
  viewportSchema,
  type AnalysisConfig,
  type ObservationRule,
  type Viewport,
} from "./analysis";

export {
  opportunityThresholdSchema,
  parseThresholdConfig,
  type OpportunityThreshold,
  DEFAULT_THRESHOLD,
} from "./opportunity-threshold";

export {
  DEFAULT_FINGERPRINTS,
  MATCH_LOCATIONS,
  TECHNOLOGY_CATEGORIES,
  fingerprintSchema,
  parseFingerprints,
  patternSchema,
  resolveFingerprint,
  type Fingerprint,
  type MatchLocation,
  type Pattern,
  type TechnologyCategory,
} from "./fingerprints";

export {
  CONVENTIONAL_PATHS,
  CONTACT_RESEARCH_CONFIG,
  ROLE_PATTERNS,
  SENIORITY_LEVELS,
  classifyRole,
  contactResearchConfigSchema,
  findSeniorityLevel,
  isSeniorityLevelId,
  validateContactResearchConfig,
  type ContactResearchConfig,
  type RolePattern,
  type SeniorityLevel,
} from "./contact-research";

export {
  DEFAULT_PROHIBITED_CLAIM_CATEGORIES,
  findProhibitedClaimCategory,
  parseProhibitedClaimCategories,
  prohibitedClaimCategoriesSchema,
  prohibitedClaimCategorySchema,
  resolveProhibitedClaimCategory,
  type ProhibitedClaimCategory,
  type ProhibitedClaimCategoryId,
  type ProhibitedClaimCategories,
} from "./research-summary";

export {
  DEFAULT_PROHIBITED_CONTENT_CATEGORIES,
  findProhibitedContentCategory,
  parseProhibitedContentCategories,
  prohibitedContentCategoriesSchema,
  prohibitedContentCategorySchema,
  resolveProhibitedContentCategory,
  type ProhibitedContentCategory,
  type ProhibitedContentCategoryId,
  type ProhibitedContentCategories,
} from "./outreach-drafting";
