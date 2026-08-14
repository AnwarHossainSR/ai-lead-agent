/**
 * The theme palette as data.
 *
 * `src/app/globals.css` is where the tokens are *applied*; this module mirrors
 * the same values so contrast and chart separation can be computed from data.
 *
 * `theme-contrast.test.ts` used to fail if the two drifted apart. It was removed
 * when the suite was cut to a fifty-case ceiling, so the mirror is now checked by
 * hand: the ratios in `docs/architecture.md` are recomputed from these values
 * whenever a token changes, and a token added to `globals.css` is added here.
 * Stated plainly because an unchecked mirror is worse than no mirror.
 */

export type ThemeName = "light" | "dark";

export type TokenName =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "danger"
  | "danger-foreground"
  | "danger-subtle"
  | "success"
  | "success-foreground"
  | "success-subtle"
  | "warning"
  | "warning-foreground"
  | "warning-subtle"
  | "info"
  | "info-foreground"
  | "info-subtle"
  | "border"
  | "input"
  | "ring"
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  | "sidebar"
  | "sidebar-foreground"
  | "sidebar-primary"
  | "sidebar-primary-foreground"
  | "sidebar-accent"
  | "sidebar-accent-foreground"
  | "sidebar-border"
  | "sidebar-ring"
  | "surface-sidebar"
  | "surface-topbar";

/** A colour as its three OKLCH components: lightness, chroma, hue. */
export type Oklch = { l: number; c: number; h: number };

const light: Record<TokenName, Oklch> = {
  background: { l: 0.975, c: 0.006, h: 255 },
  foreground: { l: 0.22, c: 0.03, h: 258 },
  card: { l: 0.995, c: 0.002, h: 255 },
  "card-foreground": { l: 0.22, c: 0.03, h: 258 },
  popover: { l: 0.995, c: 0.002, h: 255 },
  "popover-foreground": { l: 0.22, c: 0.03, h: 258 },
  primary: { l: 0.5, c: 0.17, h: 258 },
  "primary-foreground": { l: 0.99, c: 0.005, h: 255 },
  secondary: { l: 0.94, c: 0.01, h: 255 },
  "secondary-foreground": { l: 0.3, c: 0.05, h: 258 },
  muted: { l: 0.945, c: 0.008, h: 255 },
  "muted-foreground": { l: 0.47, c: 0.03, h: 258 },
  accent: { l: 0.93, c: 0.03, h: 258 },
  "accent-foreground": { l: 0.3, c: 0.08, h: 258 },
  destructive: { l: 0.52, c: 0.2, h: 27 },
  danger: { l: 0.52, c: 0.2, h: 27 },
  "danger-foreground": { l: 0.99, c: 0.01, h: 27 },
  "danger-subtle": { l: 0.95, c: 0.03, h: 27 },
  success: { l: 0.48, c: 0.13, h: 150 },
  "success-foreground": { l: 0.99, c: 0.01, h: 150 },
  "success-subtle": { l: 0.95, c: 0.04, h: 150 },
  warning: { l: 0.5, c: 0.12, h: 78 },
  "warning-foreground": { l: 0.99, c: 0.01, h: 78 },
  "warning-subtle": { l: 0.95, c: 0.05, h: 78 },
  info: { l: 0.5, c: 0.12, h: 220 },
  "info-foreground": { l: 0.99, c: 0.01, h: 220 },
  "info-subtle": { l: 0.95, c: 0.03, h: 220 },
  border: { l: 0.86, c: 0.012, h: 255 },
  input: { l: 0.64, c: 0.016, h: 255 },
  ring: { l: 0.5, c: 0.15, h: 258 },
  "chart-1": { l: 0.5, c: 0.17, h: 258 },
  "chart-2": { l: 0.62, c: 0.15, h: 150 },
  "chart-3": { l: 0.54, c: 0.14, h: 60 },
  "chart-4": { l: 0.44, c: 0.16, h: 330 },
  "chart-5": { l: 0.6, c: 0.12, h: 205 },
  sidebar: { l: 0.955, c: 0.008, h: 255 },
  "sidebar-foreground": { l: 0.22, c: 0.03, h: 258 },
  "sidebar-primary": { l: 0.5, c: 0.17, h: 258 },
  "sidebar-primary-foreground": { l: 0.99, c: 0.005, h: 255 },
  "sidebar-accent": { l: 0.92, c: 0.025, h: 258 },
  "sidebar-accent-foreground": { l: 0.3, c: 0.07, h: 258 },
  "sidebar-border": { l: 0.86, c: 0.012, h: 255 },
  "sidebar-ring": { l: 0.5, c: 0.15, h: 258 },
  // Resolved from `color-mix(in oklch, var(--card) 65%, var(--background))`.
  "surface-sidebar": { l: 0.988, c: 0.0034, h: 255 },
  // Resolved from `color-mix(in oklch, var(--background) 85%, var(--card))`.
  "surface-topbar": { l: 0.978, c: 0.0054, h: 255 },
};

const dark: Record<TokenName, Oklch> = {
  background: { l: 0.19, c: 0.015, h: 258 },
  foreground: { l: 0.96, c: 0.005, h: 255 },
  card: { l: 0.235, c: 0.018, h: 258 },
  "card-foreground": { l: 0.96, c: 0.005, h: 255 },
  popover: { l: 0.235, c: 0.018, h: 258 },
  "popover-foreground": { l: 0.96, c: 0.005, h: 255 },
  primary: { l: 0.7, c: 0.15, h: 258 },
  "primary-foreground": { l: 0.19, c: 0.03, h: 258 },
  secondary: { l: 0.29, c: 0.02, h: 258 },
  "secondary-foreground": { l: 0.96, c: 0.005, h: 255 },
  muted: { l: 0.28, c: 0.018, h: 258 },
  "muted-foreground": { l: 0.74, c: 0.02, h: 258 },
  accent: { l: 0.33, c: 0.04, h: 258 },
  "accent-foreground": { l: 0.96, c: 0.01, h: 258 },
  destructive: { l: 0.7, c: 0.17, h: 27 },
  danger: { l: 0.7, c: 0.17, h: 27 },
  "danger-foreground": { l: 0.19, c: 0.03, h: 27 },
  "danger-subtle": { l: 0.3, c: 0.06, h: 27 },
  success: { l: 0.75, c: 0.14, h: 150 },
  "success-foreground": { l: 0.19, c: 0.03, h: 150 },
  "success-subtle": { l: 0.29, c: 0.05, h: 150 },
  warning: { l: 0.79, c: 0.13, h: 78 },
  "warning-foreground": { l: 0.19, c: 0.04, h: 78 },
  "warning-subtle": { l: 0.3, c: 0.05, h: 78 },
  info: { l: 0.74, c: 0.12, h: 220 },
  "info-foreground": { l: 0.19, c: 0.03, h: 220 },
  "info-subtle": { l: 0.29, c: 0.05, h: 220 },
  border: { l: 0.36, c: 0.02, h: 258 },
  input: { l: 0.52, c: 0.022, h: 258 },
  ring: { l: 0.62, c: 0.14, h: 258 },
  "chart-1": { l: 0.64, c: 0.16, h: 258 },
  "chart-2": { l: 0.8, c: 0.14, h: 150 },
  "chart-3": { l: 0.7, c: 0.15, h: 60 },
  "chart-4": { l: 0.6, c: 0.16, h: 330 },
  "chart-5": { l: 0.76, c: 0.12, h: 205 },
  sidebar: { l: 0.22, c: 0.018, h: 258 },
  "sidebar-foreground": { l: 0.96, c: 0.005, h: 255 },
  "sidebar-primary": { l: 0.7, c: 0.15, h: 258 },
  "sidebar-primary-foreground": { l: 0.19, c: 0.03, h: 258 },
  "sidebar-accent": { l: 0.33, c: 0.04, h: 258 },
  "sidebar-accent-foreground": { l: 0.96, c: 0.01, h: 258 },
  "sidebar-border": { l: 0.36, c: 0.02, h: 258 },
  "sidebar-ring": { l: 0.62, c: 0.14, h: 258 },
  // Resolved from `color-mix(in oklch, var(--card) 65%, var(--background))`.
  "surface-sidebar": { l: 0.21925, c: 0.01695, h: 258 },
  // Resolved from `color-mix(in oklch, var(--background) 85%, var(--card))`.
  "surface-topbar": { l: 0.19675, c: 0.01545, h: 258 },
};

export const themeTokens: Record<ThemeName, Record<TokenName, Oklch>> = {
  light,
  dark,
};

/** Pairs rendering text, which must clear WCAG AA at 4.5:1. */
export const textPairs: ReadonlyArray<{
  foreground: TokenName;
  background: TokenName;
}> = [
  { foreground: "foreground", background: "background" },
  { foreground: "card-foreground", background: "card" },
  { foreground: "popover-foreground", background: "popover" },
  { foreground: "primary-foreground", background: "primary" },
  { foreground: "secondary-foreground", background: "secondary" },
  { foreground: "muted-foreground", background: "background" },
  { foreground: "muted-foreground", background: "card" },
  { foreground: "muted-foreground", background: "muted" },
  { foreground: "accent-foreground", background: "accent" },
  { foreground: "danger-foreground", background: "danger" },
  { foreground: "danger", background: "danger-subtle" },
  { foreground: "danger", background: "background" },
  { foreground: "success-foreground", background: "success" },
  { foreground: "success", background: "success-subtle" },
  { foreground: "success", background: "background" },
  { foreground: "warning-foreground", background: "warning" },
  { foreground: "warning", background: "warning-subtle" },
  { foreground: "warning", background: "background" },
  { foreground: "info-foreground", background: "info" },
  { foreground: "info", background: "info-subtle" },
  { foreground: "info", background: "background" },
  { foreground: "primary", background: "background" },
  { foreground: "primary", background: "card" },
  { foreground: "sidebar-foreground", background: "sidebar" },
  { foreground: "sidebar-accent-foreground", background: "sidebar-accent" },
  {
    foreground: "sidebar-primary-foreground",
    background: "sidebar-primary",
  },
  { foreground: "foreground", background: "surface-sidebar" },
  { foreground: "muted-foreground", background: "surface-sidebar" },
  { foreground: "primary", background: "surface-sidebar" },
  { foreground: "foreground", background: "surface-topbar" },
  { foreground: "muted-foreground", background: "surface-topbar" },
  { foreground: "primary", background: "surface-topbar" },
];

/**
 * Pairs carrying meaning without text, which must clear 3:1: the boundary of a
 * form control, a focus ring, a chart series, a status marker.
 */
export const nonTextPairs: ReadonlyArray<{
  foreground: TokenName;
  background: TokenName;
}> = [
  { foreground: "input", background: "background" },
  { foreground: "input", background: "card" },
  { foreground: "ring", background: "background" },
  { foreground: "ring", background: "card" },
  { foreground: "sidebar-ring", background: "sidebar" },
  { foreground: "input", background: "surface-sidebar" },
  { foreground: "ring", background: "surface-sidebar" },
  { foreground: "ring", background: "surface-topbar" },
  { foreground: "chart-1", background: "card" },
  { foreground: "chart-2", background: "card" },
  { foreground: "chart-3", background: "card" },
  { foreground: "chart-4", background: "card" },
  { foreground: "chart-5", background: "card" },
  { foreground: "success", background: "success-subtle" },
  { foreground: "warning", background: "warning-subtle" },
  { foreground: "danger", background: "danger-subtle" },
  { foreground: "info", background: "info-subtle" },
];

/**
 * Separators and card outlines. WCAG 1.4.11 does not require 3:1 of a purely
 * decorative boundary — no state or control identity rests on it — but it still
 * has to be visible against the surface it divides.
 */
export const decorativePairs: ReadonlyArray<{
  foreground: TokenName;
  background: TokenName;
}> = [
  { foreground: "border", background: "background" },
  { foreground: "border", background: "card" },
  { foreground: "sidebar-border", background: "sidebar" },
  { foreground: "border", background: "surface-sidebar" },
  { foreground: "border", background: "surface-topbar" },
];

/** The chart ramp, in series order. */
export const chartRamp: ReadonlyArray<TokenName> = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];
