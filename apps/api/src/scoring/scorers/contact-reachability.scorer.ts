import type { ComponentResult, Scorer } from "../scorer";
import type { CompanyEvidence } from "@mela/database";
import { getComponentRules } from "@mela/config/product/lead-scoring";

const DELIVERABLE_RANK: Record<string, number> = {
  receivable: 2,
  not_receivable: 1,
  unknown: 0,
};

function seniorityRank(seniorityId: string | undefined): number {
  if (seniorityId === undefined || seniorityId === null) return 0;
  const id = seniorityId.toLowerCase();
  if (id.includes("c_level") || id.includes("owner") || id.includes("founder")) return 3;
  if (id.includes("vp") || id.includes("director")) return 2;
  if (id.includes("manager") || id.includes("lead")) return 1;
  return 0;
}

export const contactReachabilityScorer: Scorer = {
  id: "decision_maker_found",
  score: (evidence: CompanyEvidence): ComponentResult => {
    const rules = getComponentRules("decision_maker_found");
    const contacts = evidence.contacts;

    if (contacts.length === 0) {
      return {
        value: 0,
        reasons: [],
        missing: ["contacts"],
      };
    }

    const scoredContacts = contacts.map((c) => ({
      id: c.id,
      rank: seniorityRank(c.seniorityId) + (DELIVERABLE_RANK[c.mailDeliverability] ?? 0),
    }));

    const bestRank = Math.max(...scoredContacts.map((c) => c.rank));
    const normalizedCount = contacts.length >= 3 ? 100 : (contacts.length / 3) * 100;
    const normalizedRank = (bestRank / 5) * 100;

    const normalizedScore = (normalizedCount * 0.7) + (normalizedRank * 0.3);
    const threshold = rules.thresholds.find(
      (t) => normalizedScore >= t.minimum && normalizedScore <= t.maximum,
    );

    const reasons = [
      `${contacts.length} contact${contacts.length === 1 ? "" : "s"} found`,
      `best seniority+deliverability rank ${bestRank}`,
    ];

    return {
      value: threshold?.points ?? 0,
      reasons,
      missing: [],
    };
  },
};
