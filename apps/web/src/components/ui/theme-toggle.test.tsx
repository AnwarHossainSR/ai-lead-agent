import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/theme-actions", () => ({
  setThemePreferenceAction: vi.fn(async () => {}),
  setSidebarCollapsedAction: vi.fn(async () => {}),
}));

import { setThemePreferenceAction } from "@/app/theme-actions";
import { ThemeToggle } from "./theme-toggle";

const setThemePreference = vi.mocked(setThemePreferenceAction);

beforeEach(() => {
  setThemePreference.mockClear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("<ThemeToggle>", () => {
  it("cycles light, dark and system, applying each immediately", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle preference="light" />);

    const toggle = screen.getByRole("button", { name: /^Theme: Light/ });
    expect(document.documentElement.className).not.toContain("dark");

    await user.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    await user.click(screen.getByRole("button", { name: /^Theme: Dark/ }));
    // `system` writes no class: the stylesheet follows the OS from here.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light dark");

    await user.click(screen.getByRole("button", { name: /^Theme: System/ }));
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("persists each choice so it survives a reload", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle preference="light" />);

    await user.click(screen.getByRole("button", { name: /^Theme: Light/ }));

    expect(setThemePreference).toHaveBeenCalledWith("dark");
  });

  it("says where the theme is and where the control goes, not only in an icon", () => {
    render(<ThemeToggle preference="dark" />);

    expect(
      screen.getByRole("button", { name: "Theme: Dark. Switch to System." }),
    ).toBeInTheDocument();
  });
});
