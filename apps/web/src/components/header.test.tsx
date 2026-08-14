import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Header } from "./header";

/** Task 8.3 / dashboard spec: "The signed-in account is visible." */
describe("Header", () => {
  it("shows the signed-in account's email and role, and a sign-out control", () => {
    render(<Header account={{ id: "account-1", email: "ops@example.com", role: "operator" }} />);

    expect(screen.getByText(/ops@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/operator/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows a viewer's role too, not just an operator's", () => {
    render(<Header account={{ id: "account-2", email: "viewer@example.com", role: "viewer" }} />);

    expect(screen.getByText(/viewer@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/viewer/)).toBeInTheDocument();
  });
});
