import { z } from "zod";

import { ConfigurationError } from "../internal/errors";
export { ConfigurationError } from "../internal/errors";
import { assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";
import { INDUSTRIES, findIndustry } from "./industries";
import { MAXIMUM_LEAD_SCORE, MINIMUM_LEAD_SCORE } from "./lead-priority";
import { CITIES, COUNTRIES, findCity, findCountry } from "./markets";

const SUBJECT = "Lead scoring configuration";

export const scoreComponentSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  maximum: z.number().int().min(1).max(MAXIMUM_LEAD_SCORE),
});

export type ScoreComponent = z.infer<typeof scoreComponentSchema>;

export const scoreThresholdSchema = z.object({
  minimum: z.number().int().min(MINIMUM_LEAD_SCORE).max(MAXIMUM_LEAD_SCORE),
  maximum: z.number().int().min(MINIMUM_LEAD_SCORE).max(MAXIMUM_LEAD_SCORE),
  points: z.number().int().min(0).max(MAXIMUM_LEAD_SCORE),
});

export type ScoreThreshold = z.infer<typeof scoreThresholdSchema>;

export const componentRulesSchema = z.object({
  thresholds: z.array(scoreThresholdSchema).min(1),
  unknownCeiling: z.number().int().min(0).max(MAXIMUM_LEAD_SCORE),
});

export type ComponentRules = z.infer<typeof componentRulesSchema>;

export const weightVersionSchema = z.object({
  version: z.number().int().min(1),
  fingerprint: z.string().min(1),
});

export type WeightVersion = z.infer<typeof weightVersionSchema>;

export const businessFitProfileSchema = z.object({
  targetIndustryIds: z.array(identifierSchema).min(1),
  targetCountryIds: z.array(identifierSchema).min(1),
  targetCityIds: z.array(identifierSchema).min(0),
  preferredCompanySizes: z.array(z.string().min(1)).min(0),
});

export type BusinessFitProfile = z.infer<typeof businessFitProfileSchema>;

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

export function parseComponentRules(raw: unknown): ComponentRules[] {
  const rules = parseOrThrow(SUBJECT, z.array(componentRulesSchema).min(1), raw);

  for (let index = 0; index < rules.length; index += 1) {
    validateComponentRules(`component_${index}`, rules[index]!);
  }

  return rules;
}

export function parseWeightVersion(raw: unknown): WeightVersion {
  return parseOrThrow(SUBJECT, weightVersionSchema, raw);
}

export function parseBusinessFitProfile(raw: unknown): BusinessFitProfile {
  const profile = parseOrThrow(SUBJECT, businessFitProfileSchema, raw);

  for (const industryId of profile.targetIndustryIds) {
    if (findIndustry(industryId) === undefined) {
      throw new ConfigurationError(
        SUBJECT,
        `Unknown target industry "${industryId}". Configured industries: ${INDUSTRIES.map((entry) => entry.id).join(", ")}.`,
      );
    }
  }

  for (const countryId of profile.targetCountryIds) {
    if (findCountry(countryId) === undefined) {
      throw new ConfigurationError(
        SUBJECT,
        `Unknown target country "${countryId}". Configured countries: ${COUNTRIES.map((entry) => entry.id).join(", ")}.`,
      );
    }
  }

  for (const cityId of profile.targetCityIds) {
    if (findCity(cityId) === undefined) {
      throw new ConfigurationError(
        SUBJECT,
        `Unknown target city "${cityId}". Configured cities: ${CITIES.map((entry) => entry.id).join(", ")}.`,
      );
    }
  }

  return profile;
}

export function validateComponentRules(componentId: string, rules: ComponentRules): void {
  const sorted = [...rules.thresholds].sort((left, right) => left.minimum - right.minimum);
  let expectedStart = MINIMUM_LEAD_SCORE;

  for (const threshold of sorted) {
    if (threshold.minimum > threshold.maximum) {
      throw new ConfigurationError(
        SUBJECT,
        `Component "${componentId}" has threshold minimum ${threshold.minimum} exceeding maximum ${threshold.maximum}.`,
      );
    }

    if (threshold.minimum < expectedStart) {
      throw new ConfigurationError(
        SUBJECT,
        `Component "${componentId}" has overlapping thresholds: band starts at ${threshold.minimum}, overlapping the band that ends at ${expectedStart - 1}.`,
      );
    }

    if (threshold.minimum > expectedStart) {
      throw new ConfigurationError(
        SUBJECT,
        `Component "${componentId}" has a gap: no threshold covers scores ${expectedStart} to ${threshold.minimum - 1}.`,
      );
    }

    if (threshold.points < 0 || threshold.points > MAXIMUM_LEAD_SCORE) {
      throw new ConfigurationError(
        SUBJECT,
        `Component "${componentId}" threshold can produce points ${threshold.points}, outside 0 to ${MAXIMUM_LEAD_SCORE}.`,
      );
    }

    expectedStart = threshold.maximum + 1;
  }

  if (expectedStart !== MAXIMUM_LEAD_SCORE + 1) {
    throw new ConfigurationError(
      SUBJECT,
      `Component "${componentId}" has a gap: no threshold covers scores ${expectedStart} to ${MAXIMUM_LEAD_SCORE}.`,
    );
  }

  if (rules.unknownCeiling < 0 || rules.unknownCeiling > MAXIMUM_LEAD_SCORE) {
    throw new ConfigurationError(
      SUBJECT,
      `Component "${componentId}" unknown ceiling ${rules.unknownCeiling} is outside 0 to ${MAXIMUM_LEAD_SCORE}.`,
    );
  }
}

export function computeFingerprint(components: readonly ScoreComponent[]): string {
  const values = components.map((component) => `${component.id}:${component.maximum}`).join("|");
  let hash = 0;
  for (let index = 0; index < values.length; index += 1) {
    const char = values.charCodeAt(index);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return String(Math.abs(hash));
}

export function validateWeightVersion(
  version: WeightVersion,
  components: readonly ScoreComponent[],
): void {
  const expectedFingerprint = computeFingerprint(components);

  if (version.fingerprint !== expectedFingerprint) {
    throw new ConfigurationError(
      SUBJECT,
      `Weight version ${version.version} fingerprint "${version.fingerprint}" does not match the current weights fingerprint "${expectedFingerprint}". Increment the version when weights change.`,
    );
  }
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

export const DEFAULT_WEIGHT_VERSION = parseWeightVersion({
  version: 1,
  fingerprint: computeFingerprint(SCORE_COMPONENT_DATA),
});

export const DEFAULT_BUSINESS_FIT_PROFILE = deepFreeze(
  parseBusinessFitProfile({
    targetIndustryIds: [
      "real_estate",
      "logistics",
      "hospitality",
      "ecommerce",
      "business_services",
    ],
    targetCountryIds: ["uae", "saudi_arabia"],
    targetCityIds: ["dubai", "abu_dhabi", "riyadh", "jeddah"],
    preferredCompanySizes: ["11-50", "51-200", "201-500"],
  }),
);

export const CONFIGURED_TECHNOLOGIES = deepFreeze([
  "wordpress",
  "woocommerce",
  "shopify",
  "magento",
  "react",
  "vue",
  "angular",
  "elementor",
  "divi",
  "google-analytics",
  "google-tag-manager",
  "hotjar",
  "cloudflare",
  "cloudfront",
  "stripe",
  "paypal",
  "aws",
] as const);

export type ConfiguredTechnologyId = (typeof CONFIGURED_TECHNOLOGIES)[number];

const DEFAULT_COMPONENT_RULES_RAW = [
  {
    thresholds: [
      { minimum: 0, maximum: 20, points: 5 },
      { minimum: 21, maximum: 40, points: 10 },
      { minimum: 41, maximum: 60, points: 15 },
      { minimum: 61, maximum: 80, points: 22 },
      { minimum: 81, maximum: 100, points: 30 },
    ],
    unknownCeiling: 10,
  },
  {
    thresholds: [
      { minimum: 0, maximum: 20, points: 5 },
      { minimum: 21, maximum: 40, points: 10 },
      { minimum: 41, maximum: 60, points: 15 },
      { minimum: 61, maximum: 80, points: 22 },
      { minimum: 81, maximum: 100, points: 30 },
    ],
    unknownCeiling: 10,
  },
  {
    thresholds: [
      { minimum: 0, maximum: 20, points: 4 },
      { minimum: 21, maximum: 40, points: 8 },
      { minimum: 41, maximum: 60, points: 12 },
      { minimum: 61, maximum: 80, points: 16 },
      { minimum: 81, maximum: 100, points: 20 },
    ],
    unknownCeiling: 7,
  },
  {
    thresholds: [
      { minimum: 0, maximum: 20, points: 2 },
      { minimum: 21, maximum: 40, points: 4 },
      { minimum: 41, maximum: 60, points: 6 },
      { minimum: 61, maximum: 80, points: 8 },
      { minimum: 81, maximum: 100, points: 10 },
    ],
    unknownCeiling: 3,
  },
  {
    thresholds: [
      { minimum: 0, maximum: 20, points: 2 },
      { minimum: 21, maximum: 40, points: 4 },
      { minimum: 41, maximum: 60, points: 6 },
      { minimum: 61, maximum: 80, points: 8 },
      { minimum: 81, maximum: 100, points: 10 },
    ],
    unknownCeiling: 3,
  },
] as const;

export const DEFAULT_COMPONENT_RULES = deepFreeze(parseComponentRules(DEFAULT_COMPONENT_RULES_RAW));

export function getComponentRules(componentId: string): ComponentRules {
  const index = SCORE_COMPONENTS.findIndex((c) => c.id === componentId);
  if (index === -1) {
    throw new ConfigurationError(
      SUBJECT,
      `Unknown score component "${componentId}". Configured components: ${SCORE_COMPONENTS.map((c) => c.id).join(", ")}.`,
    );
  }
  return DEFAULT_COMPONENT_RULES[index]!;
}
