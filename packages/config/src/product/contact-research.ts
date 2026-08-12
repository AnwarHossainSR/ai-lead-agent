import { z } from "zod";

/**
 * Seniority level configuration.
 *
 * Each level has a unique identifier, a display name and a rank.
 * Rank 1 is the most senior.
 */
const seniorityLevelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  rank: z.number().int().min(1),
});

export type SeniorityLevel = z.infer<typeof seniorityLevelSchema>;

/**
 * Role pattern mapping a stated job title to a seniority level.
 */
const rolePatternSchema = z.object({
  pattern: z.string().min(1),
  levelId: z.string().min(1),
});

export type RolePattern = z.infer<typeof rolePatternSchema>;

/**
 * Contact research configuration.
 *
 * Contains seniority levels, role patterns and conventional paths.
 * Contains no email pattern, address template or permutation field.
 */
export const contactResearchConfigSchema = z.object({
  seniorityLevels: z.array(seniorityLevelSchema).min(1),
  rolePatterns: z.array(rolePatternSchema),
  conventionalPaths: z.array(z.string().min(1)).min(1),
});

export type ContactResearchConfig = z.infer<typeof contactResearchConfigSchema>;

/**
 * Configured seniority levels.
 *
 * Ordered by rank (1 = most senior).
 */
export const SENIORITY_LEVELS: readonly SeniorityLevel[] = [
  { id: "c-level", displayName: "C-Level", rank: 1 },
  { id: "vp", displayName: "VP", rank: 2 },
  { id: "director", displayName: "Director", rank: 3 },
  { id: "manager", displayName: "Manager", rank: 4 },
  { id: "lead", displayName: "Lead", rank: 5 },
  { id: "senior", displayName: "Senior", rank: 6 },
  { id: "individual-contributor", displayName: "Individual Contributor", rank: 7 },
  { id: "unknown", displayName: "Unknown", rank: 8 },
] as const;

/**
 * Configured role patterns.
 *
 * Maps job titles (in English and Arabic) to seniority levels.
 */
export const ROLE_PATTERNS: readonly RolePattern[] = [
  // C-Level
  { pattern: "\\bCEO\\b", levelId: "c-level" },
  { pattern: "\\bCTO\\b", levelId: "c-level" },
  { pattern: "\\bCFO\\b", levelId: "c-level" },
  { pattern: "\\bCOO\\b", levelId: "c-level" },
  { pattern: "\\bCMO\\b", levelId: "c-level" },
  { pattern: "\\bChief\\b", levelId: "c-level" },
  { pattern: "\\bالمدير التنفيذي\\b", levelId: "c-level" },
  { pattern: "\\bالمدير المالية\\b", levelId: "c-level" },
  { pattern: "\\bالمدير التقنية\\b", levelId: "c-level" },

  // VP
  { pattern: "\\bVice President\\b", levelId: "vp" },
  { pattern: "\\bVP\\b", levelId: "vp" },
  { pattern: "\\bنائب الرئيس\\b", levelId: "vp" },

  // Director
  { pattern: "\\bDirector\\b", levelId: "director" },
  { pattern: "\\bمدير\\b", levelId: "director" },
  { pattern: "\\bHead of\\b", levelId: "director" },

  // Manager
  { pattern: "\\bManager\\b", levelId: "manager" },
  { pattern: "\\bمدير قسم\\b", levelId: "manager" },
  { pattern: "\\bTeam Lead\\b", levelId: "manager" },

  // Lead
  { pattern: "\\bLead\\b", levelId: "lead" },
  { pattern: "\\bPrincipal\\b", levelId: "lead" },

  // Senior
  { pattern: "\\bSenior\\b", levelId: "senior" },
  { pattern: "\\b资深\\b", levelId: "senior" },
] as const;

/**
 * Conventional paths that contact research may fetch.
 */
export const CONVENTIONAL_PATHS: readonly string[] = [
  "/about",
  "/about-us",
  "/contact",
  "/contact-us",
  "/team",
  "/our-team",
  "/people",
  "/leadership",
  "/company",
] as const;

/**
 * The full contact research configuration.
 */
export const CONTACT_RESEARCH_CONFIG: ContactResearchConfig = {
  seniorityLevels: [...SENIORITY_LEVELS],
  rolePatterns: [...ROLE_PATTERNS],
  conventionalPaths: [...CONVENTIONAL_PATHS],
};

/**
 * Validates the contact research configuration.
 *
 * Checks for:
 * - Duplicate seniority identifiers
 * - Duplicate ranks
 * - Role patterns mapping to unknown levels
 */
export function validateContactResearchConfig(
  config: ContactResearchConfig,
): void {
  // Check for duplicate seniority identifiers
  const ids = config.seniorityLevels.map((l) => l.id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate seniority identifiers: ${duplicateIds.join(", ")}`,
    );
  }

  // Check for duplicate ranks
  const ranks = config.seniorityLevels.map((l) => l.rank);
  const duplicateRanks = ranks.filter((r, i) => ranks.indexOf(r) !== i);
  if (duplicateRanks.length > 0) {
    const levelNames = config.seniorityLevels
      .filter((l) => duplicateRanks.includes(l.rank))
      .map((l) => l.displayName);
    throw new Error(
      `Duplicate ranks: ${levelNames.join(", ")}`,
    );
  }

  // Check for role patterns mapping to unknown levels
  const levelIds = new Set(config.seniorityLevels.map((l) => l.id));
  for (const pattern of config.rolePatterns) {
    if (!levelIds.has(pattern.levelId)) {
      throw new Error(
        `Role pattern "${pattern.pattern}" maps to unknown level "${pattern.levelId}"`,
      );
    }
  }
}

/**
 * Resolves a seniority level by ID.
 *
 * Returns the level if found, undefined otherwise.
 */
export function findSeniorityLevel(
  id: string,
): SeniorityLevel | undefined {
  return SENIORITY_LEVELS.find((l) => l.id === id);
}

/**
 * Checks if a value is a valid seniority level ID.
 */
export function isSeniorityLevelId(id: string): boolean {
  return SENIORITY_LEVELS.some((l) => l.id === id);
}

/**
 * Classifies a job title against configured role patterns.
 *
 * Returns the matching seniority level ID, or "unknown" if no pattern matches.
 */
export function classifyRole(title: string | null): string {
  if (title === null || title.trim() === "") {
    return "unknown";
  }

  for (const rolePattern of ROLE_PATTERNS) {
    const regex = new RegExp(rolePattern.pattern, "i");
    if (regex.test(title)) {
      return rolePattern.levelId;
    }
  }

  return "unknown";
}
