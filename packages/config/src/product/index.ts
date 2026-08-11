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
  AI_MODEL_TIERS,
  aiModelTierSchema,
  findAIModelTier,
  parseAIModelTiers,
  resolveAIModelTier,
  type AIModelTier,
  type AIModelTierId,
} from "./ai-model-tiers";
