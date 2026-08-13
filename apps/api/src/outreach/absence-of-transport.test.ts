import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { apiEnvSchema } from "@mela/config/env";

const FORBIDDEN_DEPENDENCY_PATTERNS = [
  /nodemailer/i,
  /smtp/i,
  /mailgun/i,
  /sendgrid/i,
  /postmark/i,
  /sparkpost/i,
  /mailjet/i,
  /amazonses/i,
  /ses/,
  /linkedin/i,
  /messaging/i,
  /whatsapp/i,
  /telegram/i,
  /slack/i,
  /discord/i,
  /twilio/i,
  /scheduler/,
  /agenda/,
  /bull/,
  /bullmq/,
];

const FORBIDDEN_ENV_KEY_PATTERNS = [
  /smtp/i,
  /sendgrid/i,
  /mailgun/i,
  /amazonses/i,
  /ses/,
  /postmark/i,
  /sparkpost/i,
  /mailjet/i,
  /nodemailer/i,
  /twilio/i,
  /linkedin/i,
  /messaging/i,
  /whatsapp/i,
  /telegram/i,
  /slack/i,
  /discord/i,
  /api_key.*send/i,
  /send.*api_key/i,
];

const FORBIDDEN_CONTROLLER_METHODS = [
  "send",
  "transmit",
  "deliver",
  "dispatch",
  "schedule",
];

describe("the outreach module contains no transport", () => {
  it("has no mail, messaging or social client in its dependency closure", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const forbidden = Object.keys(allDependencies).filter((name) =>
      FORBIDDEN_DEPENDENCY_PATTERNS.some((pattern) => pattern.test(name)),
    );

    expect(forbidden).toEqual([]);
  });

  it("the API environment schema declares no sending credential", () => {
    const shape = apiEnvSchema.shape;
    const envKeys = Object.keys(shape);

    const forbidden = envKeys.filter((key) =>
      FORBIDDEN_ENV_KEY_PATTERNS.some((pattern) => pattern.test(key)),
    );

    expect(forbidden).toEqual([]);
  });

  it("no controller in the module reports transmission or scheduling", () => {
    const moduleSource = readFileSync("src/outreach/outreach.module.ts", "utf8");

    for (const method of FORBIDDEN_CONTROLLER_METHODS) {
      expect(moduleSource.toLowerCase()).not.toContain(method);
    }
  });
});
