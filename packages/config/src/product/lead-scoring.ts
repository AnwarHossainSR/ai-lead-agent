import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";
import { MAXIMUM_LEAD_SCORE } from "./lead-priority";

const SUBJECT = "Lead scoring configuration";

export const scoreComponentSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  maximum: z.number().int().min(1).max(MAXIMUM_LEAD_SCORE),
});

export type ScoreComponent = z.infer<typeof scoreComponentSchema>;

/**
 * Validates that the component maximums sum to the full lead score. Anything
 * else would make a "score out of 100" that cannot reach 100, or one that can
 * exceed it.
 */
export function parseScoreComponents(raw: unknown): readonly ScoreComponent[] {
  const components = parseOrThrow(SUBJECT, z.array(scoreComponentSchema).min(1), raw);

  assertUniqueIdentifiers(
    SUBJECT,
    components.map((component) => component.id),
  );

  const total = components.reduce((sum, component) => sum + component.maximum, 0);

  if (total !== MAXIMUM_LEAD_SCORE) {
    throw new ConfigurationError(
      SUBJECT,
      `Component maximums total ${total}, but must total ${MAXIMUM_LEAD_SCORE}.`,
    );
  }

  return deepFreeze(components);
}

const SCORE_COMPONENT_DATA = [
  { id: "business_fit", name: "Business Fit", maximum: 30 },
  { id: "technical_opportunity", name: "Technical Opportunity", maximum: 30 },
  { id: "business_opportunity", name: "Business Opportunity", maximum: 20 },
  { id: "decision_maker_found", name: "Decision Maker Found", maximum: 10 },
  { id: "company_quality", name: "Company Quality", maximum: 10 },
] as const;

export const SCORE_COMPONENTS = parseScoreComponents(SCORE_COMPONENT_DATA);

export type ScoreComponentId = (typeof SCORE_COMPONENT_DATA)[number]["id"];

export function findScoreComponent(id: string): ScoreComponent | undefined {
  return SCORE_COMPONENTS.find((component) => component.id === id);
}

export function resolveScoreComponent(id: string): ScoreComponent {
  const component = findScoreComponent(id);

  if (component === undefined) {
    const known = SCORE_COMPONENTS.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown score component "${id}". Configured components: ${known}.`,
    );
  }

  return component;
}
