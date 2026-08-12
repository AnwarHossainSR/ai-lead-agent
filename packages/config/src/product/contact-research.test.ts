import { describe, it, expect } from "vitest";

import {
  SENIORITY_LEVELS,
  ROLE_PATTERNS,
  CONVENTIONAL_PATHS,
  CONTACT_RESEARCH_CONFIG,
  validateContactResearchConfig,
  findSeniorityLevel,
  isSeniorityLevelId,
  classifyRole,
  type ContactResearchConfig,
  type SeniorityLevel,
} from "./contact-research";

describe("contact-research configuration", () => {
  describe("SENIORITY_LEVELS", () => {
    it("contains at least one level", () => {
      expect(SENIORITY_LEVELS.length).toBeGreaterThan(0);
    });

    it("has unique identifiers", () => {
      const ids = SENIORITY_LEVELS.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("has unique ranks", () => {
      const ranks = SENIORITY_LEVELS.map((l) => l.rank);
      const uniqueRanks = new Set(ranks);
      expect(uniqueRanks.size).toBe(ranks.length);
    });

    it("has 'unknown' as the last level", () => {
      const lastLevel = SENIORITY_LEVELS[SENIORITY_LEVELS.length - 1];
      expect(lastLevel?.id).toBe("unknown");
    });
  });

  describe("ROLE_PATTERNS", () => {
    it("maps to valid seniority levels", () => {
      const levelIds = new Set(SENIORITY_LEVELS.map((l) => l.id));

      for (const pattern of ROLE_PATTERNS) {
        expect(levelIds.has(pattern.levelId)).toBe(true);
      }
    });

    it("has non-empty patterns", () => {
      for (const pattern of ROLE_PATTERNS) {
        expect(pattern.pattern.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CONVENTIONAL_PATHS", () => {
    it("contains at least one path", () => {
      expect(CONVENTIONAL_PATHS.length).toBeGreaterThan(0);
    });

    it("paths start with /", () => {
      for (const path of CONVENTIONAL_PATHS) {
        expect(path.startsWith("/")).toBe(true);
      }
    });
  });

  describe("CONTACT_RESEARCH_CONFIG", () => {
    it("contains seniority levels", () => {
      expect(CONTACT_RESEARCH_CONFIG.seniorityLevels.length).toBeGreaterThan(0);
    });

    it("contains role patterns", () => {
      expect(CONTACT_RESEARCH_CONFIG.rolePatterns.length).toBeGreaterThan(0);
    });

    it("contains conventional paths", () => {
      expect(CONTACT_RESEARCH_CONFIG.conventionalPaths.length).toBeGreaterThan(0);
    });
  });

  describe("validateContactResearchConfig", () => {
    it("accepts valid configuration", () => {
      expect(() => validateContactResearchConfig(CONTACT_RESEARCH_CONFIG)).not.toThrow();
    });

    it("rejects duplicate seniority identifiers", () => {
      const config: ContactResearchConfig = {
        seniorityLevels: [
          { id: "c-level", displayName: "C-Level", rank: 1 },
          { id: "c-level", displayName: "Duplicate", rank: 2 },
        ],
        rolePatterns: [],
        conventionalPaths: ["/about"],
      };

      expect(() => validateContactResearchConfig(config)).toThrow(/Duplicate seniority identifiers/);
    });

    it("rejects duplicate ranks", () => {
      const config: ContactResearchConfig = {
        seniorityLevels: [
          { id: "level1", displayName: "Level 1", rank: 1 },
          { id: "level2", displayName: "Level 2", rank: 1 },
        ],
        rolePatterns: [],
        conventionalPaths: ["/about"],
      };

      expect(() => validateContactResearchConfig(config)).toThrow(/Duplicate ranks/);
    });

    it("rejects pattern mapping to unknown level", () => {
      const config: ContactResearchConfig = {
        seniorityLevels: [
          { id: "c-level", displayName: "C-Level", rank: 1 },
        ],
        rolePatterns: [
          { pattern: "\\bCEO\\b", levelId: "nonexistent" },
        ],
        conventionalPaths: ["/about"],
      };

      expect(() => validateContactResearchConfig(config)).toThrow(/maps to unknown level/);
    });
  });

  describe("findSeniorityLevel", () => {
    it("finds existing level", () => {
      const level = findSeniorityLevel("c-level");
      expect(level).toBeDefined();
      expect(level?.id).toBe("c-level");
      expect(level?.displayName).toBe("C-Level");
    });

    it("returns undefined for non-existent level", () => {
      const level = findSeniorityLevel("nonexistent");
      expect(level).toBeUndefined();
    });
  });

  describe("isSeniorityLevelId", () => {
    it("returns true for valid level ID", () => {
      expect(isSeniorityLevelId("c-level")).toBe(true);
      expect(isSeniorityLevelId("unknown")).toBe(true);
    });

    it("returns false for invalid level ID", () => {
      expect(isSeniorityLevelId("nonexistent")).toBe(false);
    });
  });

  describe("classifyRole", () => {
    it("classifies CEO as c-level", () => {
      expect(classifyRole("CEO")).toBe("c-level");
    });

    it("classifies CTO as c-level", () => {
      expect(classifyRole("Chief Technology Officer")).toBe("c-level");
    });

    it("classifies VP as vp", () => {
      expect(classifyRole("Vice President")).toBe("vp");
    });

    it("classifies Director as director", () => {
      expect(classifyRole("Director of Engineering")).toBe("director");
    });

    it("classifies Manager as manager", () => {
      expect(classifyRole("Product Manager")).toBe("manager");
    });

    it("classifies Senior as senior", () => {
      expect(classifyRole("Senior Developer")).toBe("senior");
    });

    it("returns unknown for null title", () => {
      expect(classifyRole(null)).toBe("unknown");
    });

    it("returns unknown for empty title", () => {
      expect(classifyRole("")).toBe("unknown");
    });

    it("returns unknown for unmatched title", () => {
      expect(classifyRole("Software Engineer")).toBe("unknown");
    });
  });
});

describe("configuration schema", () => {
  it("has no email pattern field", () => {
    const schema = CONTACT_RESEARCH_CONFIG;
    expect(schema).not.toHaveProperty("emailPattern");
    expect(schema).not.toHaveProperty("emailPatterns");
  });

  it("has no address template field", () => {
    const schema = CONTACT_RESEARCH_CONFIG;
    expect(schema).not.toHaveProperty("addressTemplate");
    expect(schema).not.toHaveProperty("addressTemplates");
  });

  it("has no permutation field", () => {
    const schema = CONTACT_RESEARCH_CONFIG;
    expect(schema).not.toHaveProperty("permutation");
    expect(schema).not.toHaveProperty("permutations");
  });
});
