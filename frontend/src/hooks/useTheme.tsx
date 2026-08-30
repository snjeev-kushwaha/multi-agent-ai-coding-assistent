import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  color: string; // hex
  colorRgb: string; // space separated RGB channels
  colorMuted: string; // hex
  colorMutedRgb: string; // space separated RGB channels
  swatchBg: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "veo-onyx",
    name: "Veo Onyx",
    description: "Default - charcoal & soft white",
    color: "#f8fafc",
    colorRgb: "248 250 252",
    colorMuted: "#94a3b8",
    colorMutedRgb: "148 163 184",
    swatchBg: "#ffffff",
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    description: "Clear & confident",
    color: "#38bdf8",
    colorRgb: "56 189 248",
    colorMuted: "#0284c7",
    colorMutedRgb: "2 132 199",
    swatchBg: "#38bdf8",
  },
  {
    id: "midnight-azure",
    name: "Midnight Azure",
    description: "Deep blue & luminous",
    color: "#6366f1",
    colorRgb: "99 102 241",
    colorMuted: "#4f46e5",
    colorMutedRgb: "79 70 229",
    swatchBg: "#6366f1",
  },
  {
    id: "graphite-studio",
    name: "Graphite Studio",
    description: "Graphite & violet",
    color: "#a855f7",
    colorRgb: "168 85 247",
    colorMuted: "#9333ea",
    colorMutedRgb: "147 51 234",
    swatchBg: "#a855f7",
  },
  {
    id: "copper-slate",
    name: "Copper Slate",
    description: "Mineral gray & copper",
    color: "#f97316",
    colorRgb: "249 115 22",
    colorMuted: "#ea580c",
    colorMutedRgb: "234 88 12",
    swatchBg: "#f97316",
  },
  {
    id: "ember-orange",
    name: "Ember Orange",
    description: "Warm & focused",
    color: "#fb923c",
    colorRgb: "251 146 60",
    colorMuted: "#f97316",
    colorMutedRgb: "249 115 22",
    swatchBg: "#fb923c",
  },
  {
    id: "sunlit-yellow",
    name: "Sunlit Yellow",
    description: "Bright & optimistic",
    color: "#eab308",
    colorRgb: "234 179 8",
    colorMuted: "#ca8a04",
    colorMutedRgb: "202 138 4",
    swatchBg: "#eab308",
  },
  {
    id: "grove-green",
    name: "Grove Green",
    description: "Calm & grounded",
    color: "#22c55e",
    colorRgb: "34 197 94",
    colorMuted: "#16a34a",
    colorMutedRgb: "22 163 74",
    swatchBg: "#22c55e",
  },
  {
    id: "studio-rose",
    name: "Studio Rose",
    description: "Expressive & warm",
    color: "#f43f5e",
    colorRgb: "244 63 94",
    colorMuted: "#e11d48",
    colorMutedRgb: "225 29 72",
    swatchBg: "#f43f5e",
  },
  {
    id: "signal-red",
    name: "Signal Red",
    description: "Crisp & high-impact",
    color: "#ef4444",
    colorRgb: "239 68 68",
    colorMuted: "#dc2626",
    colorMutedRgb: "220 38 38",
    swatchBg: "#ef4444",
  },
  {
    id: "barbie-pink",
    name: "Barbie Pink",
    description: "Vibrant & playful",
    color: "#ec4899",
    colorRgb: "236 72 153",
    colorMuted: "#db2777",
    colorMutedRgb: "219 39 119",
    swatchBg: "#ec4899",
  },
  {
    id: "teal-horizon",
    name: "Teal Horizon",
    description: "Crisp & modern",
    color: "#14b8a6",
    colorRgb: "20 184 166",
    colorMuted: "#0d9488",
    colorMutedRgb: "13 148 136",
    swatchBg: "#14b8a6",
  },
];

interface ThemeContextType {
  mode: ThemeMode;
  colorTheme: ColorTheme;
  colorThemes: ColorTheme[];
  setMode: (mode: ThemeMode) => void;
  setColorTheme: (themeId: string) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_theme_mode");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  const [colorThemeId, setColorThemeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_color_theme");
      if (saved && COLOR_THEMES.some((t) => t.id === saved)) return saved;
    }
    return "midnight-azure";
  });

  const activeColorTheme =
    COLOR_THEMES.find((t) => t.id === colorThemeId) || COLOR_THEMES[2];

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_theme_mode", newMode);
    }
  };

  const setColorTheme = (themeId: string) => {
    setColorThemeId(themeId);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_color_theme", themeId);
    }
  };

  const toggleMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    const root = document.documentElement;

    // Toggle light / dark classes on root <html>
    if (mode === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }

    // Set accent color properties
    root.style.setProperty("--color-accent", activeColorTheme.colorRgb);
    root.style.setProperty("--color-accent-muted", activeColorTheme.colorMutedRgb);
  }, [mode, activeColorTheme]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colorTheme: activeColorTheme,
        colorThemes: COLOR_THEMES,
        setMode,
        setColorTheme,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
