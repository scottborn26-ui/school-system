import { useEffect, useState, type ReactNode } from "react";

import { ThemeContext, type Theme } from "@/components/use-theme";

const THEME_STORAGE_KEY = "shanscot-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
    return savedTheme;
  }

  return "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    const root = document.documentElement;
    const dark = resolvedTheme === "dark";

    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const root = document.documentElement;
      const dark = mediaQuery.matches;
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };

    handleSystemThemeChange();
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme: () =>
          setTheme((current) => {
            if (current === "light") return "dark";
            if (current === "dark") return "system";
            return "light";
          }),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
