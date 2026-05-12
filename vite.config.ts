import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal ambient declaration so we don't pull @types/node just for this.
declare const process: { env: Record<string, string | undefined> };

// GitHub Pages serves the site under /<repo>/, so the build needs a matching
// base path. Locally (dev/preview) we keep "/" so routing stays simple.
const base = process.env.GITHUB_ACTIONS ? "/NextDays/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
});
