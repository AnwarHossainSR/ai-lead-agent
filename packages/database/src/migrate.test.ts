import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "./migrate";
import { type TestDatabase, setupTestDatabase } from "./testing/harness";

const run = promisify(execFile);

let harness: TestDatabase;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

async function tableNames(): Promise<string[]> {
  const rows = await harness.database.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );

  return [...rows].map((row) => row.table_name);
}

describe("migrations applied to an empty database", () => {
  it("produce every table this capability describes", async () => {
    const tables = await tableNames();

    expect(tables).toEqual(
      expect.arrayContaining(["companies", "contacts", "leads", "outreach", "website_analysis"]),
    );
  });

  it("produce every enum type", async () => {
    const rows = await harness.database.execute<{ typname: string }>(
      sql`SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`,
    );

    expect([...rows].map((row) => row.typname)).toEqual(
      expect.arrayContaining([
        "certainty",
        "lead_priority",
        "lead_status",
        "outreach_channel",
        "outreach_status",
      ]),
    );
  });

  it("produce the constraints the specification names", async () => {
    const rows = await harness.database.execute<{ conname: string }>(
      sql`SELECT conname FROM pg_constraint WHERE contype = 'c' ORDER BY conname`,
    );
    const names = [...rows].map((row) => row.conname);

    expect(names).toEqual(
      expect.arrayContaining([
        "contacts_contact_details_need_a_source",
        "leads_lead_score_range",
        "leads_score_explanation_not_blank",
        "outreach_sent_requires_approval",
        "outreach_sent_at_not_before_approved_at",
        "website_analysis_accessibility_score_range",
      ]),
    );
  });

  it("produce the partial unique index that permits many website-less companies", async () => {
    const rows = await harness.database.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'companies_normalized_domain_key'`,
    );

    expect([...rows][0]?.indexdef).toMatch(
      /UNIQUE INDEX .* WHERE \(normalized_domain IS NOT NULL\)/,
    );
  });
});

describe("running the migrations again", () => {
  it("completes and changes nothing", async () => {
    const before = await tableNames();

    await runMigrations({ url: harness.url });
    await runMigrations({ url: harness.url });

    expect(await tableNames()).toEqual(before);
  });
});

describe("the drift check", () => {
  it("reports the committed migrations as consistent", async () => {
    const packageRoot = resolve(__dirname, "..");

    // drizzle-kit check validates the committed migration set. The other half
    // of drift — a schema edit with no migration generated — is caught in CI
    // by running `drizzle-kit generate` and failing if it produces a file,
    // because that check needs a clean git tree to be meaningful.
    //
    // The CLI is invoked through node with its resolved entry point rather
    // than through `pnpm exec`, which on Windows means spawning a .cmd and so
    // needs a shell.
    // Resolved by path rather than by specifier: drizzle-kit's "exports" map
    // does not expose its own binary.
    const cli = resolve(packageRoot, "node_modules", "drizzle-kit", "bin.cjs");
    const { stdout, stderr } = await run(process.execPath, [cli, "check"], { cwd: packageRoot });

    expect(`${stdout}${stderr}`).not.toMatch(/collision|error/i);
  });
});
