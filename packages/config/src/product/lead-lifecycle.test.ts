import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import {
  INITIAL_LEAD_STATUS,
  LEAD_STATUSES,
  LeadStatusTransitionError,
  TERMINAL_LEAD_STATUSES,
  assertTransition,
  canTransition,
  parseLifecycle,
  permittedTransitions,
} from "./lead-lifecycle";

describe("configured statuses", () => {
  it("are exactly the fourteen the product defines", () => {
    expect([...LEAD_STATUSES]).toEqual([
      "discovered",
      "verified",
      "analyzing",
      "qualified",
      "high_priority",
      "contacted",
      "replied",
      "interested",
      "meeting",
      "proposal",
      "won",
      "lost",
      "not_interested",
      "rejected",
    ]);
  });

  it("start a lead at discovered", () => {
    expect(INITIAL_LEAD_STATUS).toBe("discovered");
  });
});

describe("a permitted transition", () => {
  it("is allowed from discovered to verified", () => {
    expect(canTransition("discovered", "verified")).toBe(true);
    expect(() => assertTransition("discovered", "verified")).not.toThrow();
  });
});

describe("an arbitrary transition", () => {
  it("is refused from discovered to won", () => {
    expect(canTransition("discovered", "won")).toBe(false);
  });

  it("names the source, the target and the permitted targets", () => {
    let thrown: unknown;
    try {
      assertTransition("discovered", "won");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LeadStatusTransitionError);
    const failure = thrown as LeadStatusTransitionError;

    expect(failure.from).toBe("discovered");
    expect(failure.to).toBe("won");
    expect([...failure.permitted]).toEqual(["verified", "rejected"]);
    expect(failure.message).toContain('from "discovered" to "won"');
    expect(failure.message).toContain("verified, rejected");
  });
});

describe("terminal statuses", () => {
  it("are won, lost, not_interested and rejected", () => {
    expect([...TERMINAL_LEAD_STATUSES].sort()).toEqual([
      "lost",
      "not_interested",
      "rejected",
      "won",
    ]);
  });

  it("permit no outbound transition", () => {
    for (const status of TERMINAL_LEAD_STATUSES) {
      expect(permittedTransitions(status)).toEqual([]);
    }
  });

  it("say so when a transition out of them is attempted", () => {
    expect(() => assertTransition("won", "contacted")).toThrow(/terminal status/);
  });
});

describe("an unknown status", () => {
  it("is refused rather than treated as terminal", () => {
    expect(() => permittedTransitions("archived")).toThrow(ConfigurationError);
    expect(() => permittedTransitions("archived")).toThrow(/Unknown source status "archived"/);
  });

  it("is refused as a transition target", () => {
    expect(() => canTransition("discovered", "archived")).toThrow(
      /Unknown target status "archived"/,
    );
  });
});

describe("lifecycle validation", () => {
  const valid = {
    statuses: ["draft", "sent", "done"],
    terminalStatuses: ["done"],
    transitions: { draft: ["sent"], sent: ["done"], done: [] },
    initialStatus: "draft",
  };

  it("accepts a well-formed lifecycle", () => {
    expect(() => parseLifecycle(valid)).not.toThrow();
  });

  it("refuses a transition target that is not a configured status", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, transitions: { ...valid.transitions, draft: ["archived"] } });

    expect(load).toThrow(/"draft" -> "archived" names a target that is not a configured status/);
  });

  it("refuses a transition set declared for an unknown status", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, transitions: { ...valid.transitions, archived: [] } });

    expect(load).toThrow(/Transition set declared for "archived"/);
  });

  it("refuses a status with no transition set at all", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, statuses: [...valid.statuses, "paused"] });

    expect(load).toThrow(/Status "paused" has no transition set/);
  });

  it("refuses a terminal status with outbound transitions", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, transitions: { ...valid.transitions, done: ["draft"] } });

    expect(load).toThrow(/Terminal status "done" must have no outbound transitions/);
  });

  it("refuses a dead end that is not declared terminal", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, transitions: { ...valid.transitions, sent: [] } });

    expect(load).toThrow(/Status "sent" has no outbound transitions but is not declared terminal/);
  });

  it("refuses an initial status that is not configured", () => {
    const load = (): unknown => parseLifecycle({ ...valid, initialStatus: "archived" });

    expect(load).toThrow(/Initial status "archived" is not a configured status/);
  });

  it("refuses a terminal status that is not configured", () => {
    const load = (): unknown => parseLifecycle({ ...valid, terminalStatuses: ["archived"] });

    expect(load).toThrow(/Terminal status "archived" is not a configured status/);
  });

  it("refuses a duplicated status", () => {
    const load = (): unknown =>
      parseLifecycle({ ...valid, statuses: [...valid.statuses, "draft"] });

    expect(load).toThrow(/The status list contains a duplicate/);
  });
});

describe("every configured status", () => {
  it("is reachable as a transition target except the initial one", () => {
    const targets = new Set(LEAD_STATUSES.flatMap((status) => [...permittedTransitions(status)]));
    const unreachable = LEAD_STATUSES.filter(
      (status) => status !== INITIAL_LEAD_STATUS && !targets.has(status),
    );

    expect(unreachable).toEqual([]);
  });
});
