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
      parseOutreachChannels([{ id: "email", name: "Email", automatedSendingPermitted: true }]);

    expect(load).toThrow(/0\.automatedSendingPermitted/);
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
