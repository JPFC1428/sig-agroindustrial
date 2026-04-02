import type { AccentColor, ThemePreference } from "./types";

type ThemeAccentTokens = {
  chart1: string;
  primary: string;
  primaryForeground: string;
  ring: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarRing: string;
};

type ThemeAccentPalette = Record<ThemePreference, ThemeAccentTokens>;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";
export const DEFAULT_ACCENT_COLOR: AccentColor = "blue";

export const THEME_OPTIONS: Array<{
  description: string;
  label: string;
  value: ThemePreference;
}> = [
  {
    description: "Interfaz clara y neutra para uso diario.",
    label: "Claro",
    value: "light",
  },
  {
    description: "Interfaz oscura para ambientes de baja luz.",
    label: "Oscuro",
    value: "dark",
  },
];

export const ACCENT_COLOR_OPTIONS: Array<{
  description: string;
  label: string;
  value: AccentColor;
}> = [
  {
    description: "Azul corporativo por defecto.",
    label: "Azul",
    value: "blue",
  },
  {
    description: "Verde comercial sobrio.",
    label: "Verde",
    value: "green",
  },
  {
    description: "Naranja para un acento mas calido.",
    label: "Naranja",
    value: "orange",
  },
  {
    description: "Rojo para un acento mas intenso.",
    label: "Rojo",
    value: "red",
  },
  {
    description: "Teal para un acento mas fresco.",
    label: "Teal",
    value: "teal",
  },
];

export const ACCENT_COLOR_SWATCHES: Record<AccentColor, string> = {
  blue: "oklch(0.623 0.214 259.815)",
  green: "oklch(0.627 0.17 149.214)",
  orange: "oklch(0.705 0.19 52)",
  red: "oklch(0.637 0.237 25.331)",
  teal: "oklch(0.61 0.12 210)",
};

export const ACCENT_COLOR_TOKENS: Record<AccentColor, ThemeAccentPalette> = {
  blue: {
    light: {
      chart1: "oklch(0.623 0.214 259.815)",
      primary: "oklch(0.623 0.214 259.815)",
      primaryForeground: "oklch(1 0 0)",
      ring: "oklch(0.623 0.214 259.815)",
      sidebarPrimary: "oklch(0.623 0.214 259.815)",
      sidebarPrimaryForeground: "oklch(1 0 0)",
      sidebarRing: "oklch(0.623 0.214 259.815)",
    },
    dark: {
      chart1: "oklch(0.7 0.2 259.815)",
      primary: "oklch(0.7 0.2 259.815)",
      primaryForeground: "oklch(0.1 0 0)",
      ring: "oklch(0.7 0.2 259.815)",
      sidebarPrimary: "oklch(0.7 0.2 259.815)",
      sidebarPrimaryForeground: "oklch(0.1 0 0)",
      sidebarRing: "oklch(0.7 0.2 259.815)",
    },
  },
  green: {
    light: {
      chart1: "oklch(0.627 0.17 149.214)",
      primary: "oklch(0.627 0.17 149.214)",
      primaryForeground: "oklch(1 0 0)",
      ring: "oklch(0.627 0.17 149.214)",
      sidebarPrimary: "oklch(0.627 0.17 149.214)",
      sidebarPrimaryForeground: "oklch(1 0 0)",
      sidebarRing: "oklch(0.627 0.17 149.214)",
    },
    dark: {
      chart1: "oklch(0.74 0.16 149.214)",
      primary: "oklch(0.74 0.16 149.214)",
      primaryForeground: "oklch(0.1 0 0)",
      ring: "oklch(0.74 0.16 149.214)",
      sidebarPrimary: "oklch(0.74 0.16 149.214)",
      sidebarPrimaryForeground: "oklch(0.1 0 0)",
      sidebarRing: "oklch(0.74 0.16 149.214)",
    },
  },
  orange: {
    light: {
      chart1: "oklch(0.705 0.19 52)",
      primary: "oklch(0.705 0.19 52)",
      primaryForeground: "oklch(1 0 0)",
      ring: "oklch(0.705 0.19 52)",
      sidebarPrimary: "oklch(0.705 0.19 52)",
      sidebarPrimaryForeground: "oklch(1 0 0)",
      sidebarRing: "oklch(0.705 0.19 52)",
    },
    dark: {
      chart1: "oklch(0.77 0.17 52)",
      primary: "oklch(0.77 0.17 52)",
      primaryForeground: "oklch(0.1 0 0)",
      ring: "oklch(0.77 0.17 52)",
      sidebarPrimary: "oklch(0.77 0.17 52)",
      sidebarPrimaryForeground: "oklch(0.1 0 0)",
      sidebarRing: "oklch(0.77 0.17 52)",
    },
  },
  red: {
    light: {
      chart1: "oklch(0.637 0.237 25.331)",
      primary: "oklch(0.637 0.237 25.331)",
      primaryForeground: "oklch(1 0 0)",
      ring: "oklch(0.637 0.237 25.331)",
      sidebarPrimary: "oklch(0.637 0.237 25.331)",
      sidebarPrimaryForeground: "oklch(1 0 0)",
      sidebarRing: "oklch(0.637 0.237 25.331)",
    },
    dark: {
      chart1: "oklch(0.72 0.19 25.331)",
      primary: "oklch(0.72 0.19 25.331)",
      primaryForeground: "oklch(0.1 0 0)",
      ring: "oklch(0.72 0.19 25.331)",
      sidebarPrimary: "oklch(0.72 0.19 25.331)",
      sidebarPrimaryForeground: "oklch(0.1 0 0)",
      sidebarRing: "oklch(0.72 0.19 25.331)",
    },
  },
  teal: {
    light: {
      chart1: "oklch(0.61 0.12 210)",
      primary: "oklch(0.61 0.12 210)",
      primaryForeground: "oklch(1 0 0)",
      ring: "oklch(0.61 0.12 210)",
      sidebarPrimary: "oklch(0.61 0.12 210)",
      sidebarPrimaryForeground: "oklch(1 0 0)",
      sidebarRing: "oklch(0.61 0.12 210)",
    },
    dark: {
      chart1: "oklch(0.73 0.11 210)",
      primary: "oklch(0.73 0.11 210)",
      primaryForeground: "oklch(0.1 0 0)",
      ring: "oklch(0.73 0.11 210)",
      sidebarPrimary: "oklch(0.73 0.11 210)",
      sidebarPrimaryForeground: "oklch(0.1 0 0)",
      sidebarRing: "oklch(0.73 0.11 210)",
    },
  },
};
