import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const pathname = { current: "/leads" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { MobileNav } from "./mobile-nav";

describe("<MobileNav>", () => {
  it("makes navigation reachable through a control rather than absent", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Operations" })).toBeInTheDocument();
  });

  it("marks the current route", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(await screen.findByRole("link", { name: "Leads" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Companies" })).not.toHaveAttribute("aria-current");
  });

  it("opens and closes with the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.tab();
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Navigation" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("traps focus while it is open", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await user.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Navigation" });

    for (let step = 0; step < 8; step += 1) {
      await user.tab();
      const active = document.activeElement;
      const trapped =
        drawer.contains(active) || active?.hasAttribute("data-base-ui-focus-guard") === true;
      expect(trapped, `tab ${step} escaped the drawer`).toBe(true);
    }
  });
});
