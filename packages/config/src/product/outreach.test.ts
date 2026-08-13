import { describe, expect, it } from "vitest";

import {
  OUTREACH_CHANNELS,
  automatedSendingIsForbiddenEverywhere,
  parseOutreachChannels,
  resolveOutreachChannel,
} from "./outreach";

describe("configured channels", () => {
  it("are email, LinkedIn and WhatsApp", () => {
    expect(OUTREACH_CHANNELS.map((channel) => channel.id)).toEqual([
      "email",
      "linkedin",
      "whatsapp",
    ]);
  });

  it("each declare a tone, subject applicability and length limits", () => {
    for (const channel of OUTREACH_CHANNELS) {
      expect(channel.tone.length).toBeGreaterThan(0);
      expect(typeof channel.subjectApplies).toBe("boolean");
      expect(channel.maxSubjectLength).toBeGreaterThan(0);
      expect(channel.maxBodyLength).toBeGreaterThan(0);
    }
  });

  it("email has a subject and shorter limits than LinkedIn body", () => {
    const email = resolveOutreachChannel("email");
    const linkedin = resolveOutreachChannel("linkedin");

    expect(email.subjectApplies).toBe(true);
    expect(linkedin.subjectApplies).toBe(false);
    expect(email.maxBodyLength).toBeLessThan(linkedin.maxBodyLength);
  });
});

describe("automated sending", () => {
  it("is declared not permitted on every channel", () => {
    for (const channel of OUTREACH_CHANNELS) {
      expect(channel.automatedSendingPermitted).toBe(false);
    }
  });

  it("is forbidden across the whole configuration", () => {
    expect(automatedSendingIsForbiddenEverywhere()).toBe(true);
  });

  it("cannot be enabled by editing configuration alone", () => {
    const load = (): unknown =>
      parseOutreachChannels([
        {
          id: "email",
          name: "Email",
          tone: "Professional",
          subjectApplies: true,
          maxSubjectLength: 120,
          maxBodyLength: 2000,
          automatedSendingPermitted: true,
        },
      ]);

    expect(load).toThrow(/0\.automatedSendingPermitted/);
  });

  it("rejects a channel with a non-positive max subject length", () => {
    expect(() =>
      parseOutreachChannels([
        {
          id: "email",
          name: "Email",
          tone: "Professional",
          subjectApplies: true,
          maxSubjectLength: 0,
          maxBodyLength: 2000,
          automatedSendingPermitted: false,
        },
      ]),
    ).toThrow(/0\.maxSubjectLength/);
  });

  it("rejects a channel with a non-positive max body length", () => {
    expect(() =>
      parseOutreachChannels([
        {
          id: "email",
          name: "Email",
          tone: "Professional",
          subjectApplies: true,
          maxSubjectLength: 120,
          maxBodyLength: -1,
          automatedSendingPermitted: false,
        },
      ]),
    ).toThrow(/0\.maxBodyLength/);
  });

  it("rejects a channel with a blank tone", () => {
    expect(() =>
      parseOutreachChannels([
        {
          id: "email",
          name: "Email",
          tone: "   ",
          subjectApplies: true,
          maxSubjectLength: 120,
          maxBodyLength: 2000,
          automatedSendingPermitted: false,
        },
      ]),
    ).toThrow(/0\.tone/);
  });
});

describe("resolving a channel", () => {
  it("returns the configured entry", () => {
    expect(resolveOutreachChannel("whatsapp").name).toBe("WhatsApp");
  });

  it("refuses an unknown identifier", () => {
    expect(() => resolveOutreachChannel("sms")).toThrow(/Unknown outreach channel "sms"/);
  });
});
