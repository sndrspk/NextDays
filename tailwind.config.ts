import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        accent: {
          DEFAULT: "#0a84ff",
          50: "#eff8ff",
          100: "#dbecff",
          500: "#0a84ff",
          600: "#0070e0",
          700: "#0058b1",
        },
        canvas: "#f5f5f7",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        elevated:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -8px rgba(15, 23, 42, 0.12)",
        panel:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 24px 64px -16px rgba(15, 23, 42, 0.28)",
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
