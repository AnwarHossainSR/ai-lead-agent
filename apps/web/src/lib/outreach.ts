/** A citation behind a claim the drafted message makes, resolved at draft time. */
export interface OutreachCitation {
  readonly ref: string;
  readonly detail: string;
  readonly url: string | null;
  readonly certainty: "observed" | "inferred" | null;
}

export interface OutreachClaim {
  readonly text: string;
  readonly citations: readonly OutreachCitation[];
}

/** An outreach message — `GET /api/outreach/:id`, `GET /api/outreach`. */
export interface OutreachRecord {
  readonly id: string;
  readonly leadId: string;
  readonly channel: string;
  readonly subject: string | null;
  readonly messageBody: string;
  readonly status: string;
  readonly isHumanEdited: boolean;
  readonly citedFacts: readonly OutreachClaim[];
  readonly rejectionReason: string | null;
  readonly createdAt: string;
}
