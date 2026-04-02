import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext";
import {
  ACCENT_COLOR_TOKENS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_THEME_PREFERENCE,
} from "@/lib/theme-config";
import type { AccentColor, ThemePreference } from "@/lib/types";

interface ThemeContextType {
  accentColor: AccentColor;
  theme: ThemePreference;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
}

const THEME_STORAGE_KEY = "sig-theme-preference";
const ACCENT_STORAGE_KEY = "sig-accent-color";

function readStoredThemePreference() {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" ? "dark" : DEFAULT_THEME_PREFERENCE;
}

function readStoredAccentColor() {
  if (typeof window === "undefined") {
    return DEFAULT_ACCENT_COLOR;
  }

  const storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return storedAccent && storedAccent in ACCENT_COLOR_TOKENS
    ? (storedAccent as AccentColor)
    : DEFAULT_ACCENT_COLOR;
}

function applyAccentColor(accentColor: AccentColor, theme: ThemePreference) {
  const root = document.documentElement;
  const tokens = ACCENT_COLOR_TOKENS[accentColor][theme];

  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--sidebar-primary", tokens.sidebarPrimary);
  root.style.setProperty(
    "--sidebar-primary-foreground",
    tokens.sidebarPrimaryForeground
  );
  root.style.setProperty("--ring", tokens.ring);
  root.style.setProperty("--sidebar-ring", tokens.sidebarRing);
  root.style.setProperty("--chart-1", tokens.chart1);
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME_PREFERENCE,
}: ThemeProviderProps) {
  const { isLoading, user } = useAuth();

  const resolvedTheme = useMemo(() => {
    if (user?.preferencias.themePreference) {
      return user.preferencias.themePreference;
    }

    if (isLoading) {
      return readStoredThemePreference();
    }

    return defaultTheme;
  }, [defaultTheme, isLoading, user]);

  const resolvedAccentColor = useMemo(() => {
    if (user?.preferencias.accentColor) {
      return user.preferencias.accentColor;
    }

    if (isLoading) {
      return readStoredAccentColor();
    }

    return DEFAULT_ACCENT_COLOR;
  }, [isLoading, user]);

  useEffect(() => {
    const root = document.documentElement;

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    applyAccentColor(resolvedAccentColor, resolvedTheme);

    if (typeof window === "undefined") {
      return;
    }

    if (user) {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, resolvedAccentColor);
      return;
    }

    if (!isLoading) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      window.localStorage.removeItem(ACCENT_STORAGE_KEY);
    }
  }, [isLoading, resolvedAccentColor, resolvedTheme, user]);

  return (
    <ThemeContext.Provider
      value={{
        accentColor: resolvedAccentColor,
        theme: resolvedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
