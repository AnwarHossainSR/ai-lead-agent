import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger>Reject message</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this message?</DialogTitle>
          <DialogDescription>The draft returns to the queue.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <button type="button">Reject</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("<Dialog>", () => {
  it("opens from its trigger and names itself", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    await user.click(screen.getByRole("button", { name: "Reject message" }));

    expect(await screen.findByRole("dialog", { name: "Reject this message?" })).toBeInTheDocument();
  });

  it("traps focus inside the dialog while it is open", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    const trigger = screen.getByRole("button", { name: "Reject message" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");

    // Tab all the way round twice. Focus stays in the dialog, apart from the
    // sentinel Base UI parks it on to wrap the cycle — it never reaches the
    // trigger or the page behind the dialog.
    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      const active = document.activeElement;
      const trapped =
        dialog.contains(active) || active?.hasAttribute("data-base-ui-focus-guard") === true;

      expect(trapped, `tab ${step} escaped to ${active?.outerHTML.slice(0, 60)}`).toBe(true);
      expect(active).not.toBe(trigger);
      expect(active).not.toBe(document.body);
    }
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    const trigger = screen.getByRole("button", { name: "Reject message" });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it("offers a labelled close control", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog />);

    await user.click(screen.getByRole("button", { name: "Reject message" }));

    expect(await screen.findByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
