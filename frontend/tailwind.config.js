/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0b0d11",
        surface: "#13161c",
        surfaceRaised: "#1a1e26",
        border: "#262b35",
        accent: "#6366f1",
        accentMuted: "#4338ca",
        success: "#22c55e",
        danger: "#ef4444",
        warning: "#eab308",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
