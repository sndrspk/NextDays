import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Theme-aware colors (white, the used slate/stone shades, line, accent) are
// CSS variables defined in a `@theme` block in src/index.css, so the active
// theme — set as `data-theme` on <html> by SettingsProvider — can swap the
// whole palette without touching components.

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // `--app-font-sans` is set on <html> by SettingsProvider; falls back to
        // Inter when the variable hasn't been hydrated yet (first paint, SSR).
        sans: [
          'var(--app-font-sans, "Inter Variable")',
          '"Inter Variable"',
          ...defaultTheme.fontFamily.sans,
        ],
      },
      colors: {
        canvas: "#f7f7fb",
        ink: {
          900: "#1f2330",
          700: "#3a3f52",
          500: "#6b7184",
          400: "#9097ab",
          300: "#b9bfcf",
        },
      },
      boxShadow: {
        // Very subtle surfaces; the design now relies on thin borders, not shadow stacks.
        card: "0 1px 1px rgba(31, 35, 48, 0.04)",
        elevated: "0 1px 2px rgba(31, 35, 48, 0.05)",
        panel: "0 10px 30px -12px rgba(31, 35, 48, 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.2, 0.7, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 160ms cubic-bezier(0.2, 0.7, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
