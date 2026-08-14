import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Contact } from "@/lib/lead-detail";
import { ContactList } from "./contact-list";

const SOURCED_CONTACT: Contact = {
  id: "contact-1",
  name: "Sara Al Mansoori",
  jobTitle: "Head of E-commerce",
  email: "sara@example.com",
  phone: null,
  certainty: "observed",
  sourceUrl: "https://example.com/team",
  researchSource: "team_page",
  createdAt: "2026-01-01T00:00:00Z",
  doNotContactAt: null,
  doNotContactReason: null,
  doNotContactByAccountId: null,
};

const UNSOURCED_CONTACT: Contact = {
  id: "contact-2",
  name: "Unnamed IT Contact",
  jobTitle: null,
  email: null,
  phone: null,
  certainty: "inferred",
  sourceUrl: null,
  researchSource: "linkedin_search",
  createdAt: "2026-01-01T00:00:00Z",
  doNotContactAt: null,
  doNotContactReason: null,
  doNotContactByAccountId: null,
};

describe("ContactList", () => {
  it("a sourced email's source URL is a link, once opened", async () => {
    const user = userEvent.setup();
    render(<ContactList contacts={[SOURCED_CONTACT]} />);

    await user.click(screen.getByText("sara@example.com"));

    const link = await screen.findByRole("link", { name: "https://example.com/team" });
    expect(link).toHaveAttribute("href", "https://example.com/team");
  });

  it("an inferred contact's name carries the inferred marker", () => {
    render(<ContactList contacts={[UNSOURCED_CONTACT]} />);

    const name = screen.getByRole("button", { name: /Unnamed IT Contact/ });
    expect(name).toHaveAttribute("data-certainty", "inferred");
  });

  it("a missing email or phone renders the word unknown", () => {
    render(<ContactList contacts={[UNSOURCED_CONTACT]} />);

    expect(screen.getAllByText("unknown")).toHaveLength(2);
  });

  it("shows an empty state rather than an empty list", () => {
    render(<ContactList contacts={[]} />);

    expect(screen.getByText("No contacts found.")).toBeInTheDocument();
  });

  it("shows a do-not-contact marker with its reason and who set it (task 8.5)", () => {
    render(
      <ContactList
        contacts={[
          {
            ...SOURCED_CONTACT,
            doNotContactAt: "2026-01-05T00:00:00Z",
            doNotContactReason: "Asked to stop.",
            doNotContactByAccountId: "account-1",
          },
        ]}
        accounts={[{ id: "account-1", email: "ops@example.com", role: "operator" }]}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Asked to stop.");
    expect(alert).toHaveTextContent(/Marked by ops@example\.com at/);
  });
});
