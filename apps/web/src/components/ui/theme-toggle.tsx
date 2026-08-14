"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { setThemePreferenceAction } from "@/app/theme-actions";
import { Button } from "@/components/ui/button";
import {
  type ThemePreference,
  nextThemePreference,
  themeClass,
  themeColorScheme,
} from "@/lib/theme";

const icons: Record<ThemePreference, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const labels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Cycles light → dark → system. The class on `<html>` is rewritten immediately
 * so the change is instant and needs no reload; the Server Action only makes it
 * survive one, since the server reads the same cookie when it renders.
 */
export function ThemeToggle({ preference }: { preference: ThemePreference }) {
  const [current, setCurrent] = useState<ThemePreference>(preference);
  const [, startTransition] = useTransition();

  function apply(next: ThemePreference) {
    setCurrent(next);

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const className = themeClass(next);
    if (className !== "") root.classList.add(className);
    root.style.colorScheme = themeColorScheme(next);
    root.dataset.theme = next;

    startTransition(async () => {
      await setThemePreferenceAction(next);
    });
  }

  const Icon = icons[current];
  const next = nextThemePreference(current);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      data-theme-preference={current}
      // The label states both where the theme is and where the control goes,
      // so the meaning does not rest on the icon alone.
      aria-label={`Theme: ${labels[current]}. Switch to ${labels[next]}.`}
      title={`Theme: ${labels[current]}`}
      onClick={() => apply(next)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
