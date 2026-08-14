import { relations } from "drizzle-orm";

import { accounts } from "./accounts";
import { auditLog } from "./audit-log";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { leads } from "./leads";
import { outreach } from "./outreach";
import { sessions } from "./sessions";
import { websiteAnalysis } from "./website-analysis";

/**
 * Relation declarations for Drizzle's relational queries. They describe the
 * foreign keys already declared on the tables; they create nothing and enforce
 * nothing, so the cascade rules live with the columns, not here.
 */

export const companiesRelations = relations(companies, ({ many, one }) => ({
  contacts: many(contacts),
  analyses: many(websiteAnalysis),
  lead: one(leads),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
}));

export const websiteAnalysisRelations = relations(websiteAnalysis, ({ one }) => ({
  company: one(companies, { fields: [websiteAnalysis.companyId], references: [companies.id] }),
}));

export const leadsRelations = relations(leads, ({ many, one }) => ({
  company: one(companies, { fields: [leads.companyId], references: [companies.id] }),
  outreach: many(outreach),
}));

export const outreachRelations = relations(outreach, ({ one }) => ({
  lead: one(leads, { fields: [outreach.leadId], references: [leads.id] }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  sessions: many(sessions),
  auditEntries: many(auditLog),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, { fields: [sessions.accountId], references: [accounts.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  account: one(accounts, { fields: [auditLog.accountId], references: [accounts.id] }),
}));
