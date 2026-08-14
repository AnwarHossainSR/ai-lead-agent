import { render, screen } from "@testing-library/react";
import { use } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Panel } from "./panel";

function Thrower(): never {
  throw new Error("Boom from a panel body.");
}

function Suspender({ promise }: { promise: Promise<string> }) {
  const value = use(promise);
  return <p>{value}</p>;
}

describe("Panel", () => {
  it("renders children normally when nothing fails", () => {
    render(
      <Panel title="Leads">
        <p>Leads content</p>
      </Panel>,
    );

    expect(screen.getByText("Leads content")).toBeInTheDocument();
  });

  describe("when a child throws", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // React logs the error the boundary caught; expected here, so it is
      // silenced rather than left to look like an unhandled test failure.
      consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    it("renders the error state naming the panel, without taking down the rest of the tree", () => {
      render(
        <div>
          <Panel title="Leads">
            <Thrower />
          </Panel>
          <p>Sibling content</p>
        </div>,
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Leads is unavailable");
      expect(screen.getByText("Boom from a panel body.")).toBeInTheDocument();
      expect(screen.getByText("Sibling content")).toBeInTheDocument();
    });
  });

  it("shows the fallback while the child is suspended", () => {
    const pending = new Promise<string>(() => {
      // Never settles — this test only asserts the fallback shows while
      // pending; React's own test suite covers Suspense's own resolution.
    });

    render(
      <Panel title="Leads" fallback={<p>Loading leads…</p>}>
        <Suspender promise={pending} />
      </Panel>,
    );

    expect(screen.getByText("Loading leads…")).toBeInTheDocument();
  });
});
