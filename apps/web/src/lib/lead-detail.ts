/** A lead with its score breakdown, explanation and company context — `GET /api/leads/:id`. */
export interface LeadDetail {
  readonly id: string;
  readonly companyId: string;
  readonly leadScore: number;
  readonly priority: string;
  readonly status: string;
  readonly businessFitScore: number;
  readonly technicalOpportunityScore: number;
  readonly businessOpportunityScore: number;
  readonly decisionMakerFoundScore: number;
  readonly companyQualityScore: number;
  readonly scoreExplanation: string;
  readonly recommendedServiceId: string | null;
  readonly contactReason: string | null;
  readonly scoredAt: string;
  readonly isStale: boolean;
  readonly company: {
    readonly id: string;
    readonly name: string;
    readonly industryId: string;
    readonly cityId: string | null;
    readonly countryId: string;
    readonly website: string | null;
    readonly verificationState: string;
    readonly discoverySource: string;
    readonly discoverySourceUrl: string;
    readonly doNotContactAt: string | null;
    readonly doNotContactReason: string | null;
  };
}

/** A citation resolved back to what it referred to — `GET /api/companies/:id/opportunities`. */
export interface ResolvedEvidence {
  readonly ref: string;
  readonly detail: string;
  readonly url: string | null;
}

export interface OpportunityWithEvidence {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly certainty: "observed" | "inferred";
  readonly citedEvidence: readonly string[];
  readonly resolvedEvidence: readonly ResolvedEvidence[];
  readonly createdAt: string;
}

/** A technology detection — `GET /api/companies/:id/technologies`. */
export interface TechnologyDetection {
  readonly id: string;
  readonly technologyId: string;
  readonly category: string;
  readonly certainty: "observed" | "inferred";
  readonly matchedIn: string | null;
  readonly matchedText: string | null;
  readonly impliedBy: string | null;
}

/** The latest completed analysis — `GET /api/companies/:id/analysis/latest`. */
export interface LatestAnalysis {
  readonly companyId: string;
  readonly outcome: string | null;
  readonly analysedUrl: string | null;
  readonly createdAt: string | null;
}

/** A contact — `GET /api/companies/:id/contacts`. */
export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly certainty: "observed" | "inferred";
  readonly sourceUrl: string | null;
  readonly researchSource: string;
  readonly createdAt: string;
}
