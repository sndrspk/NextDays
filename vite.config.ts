import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Minimal ambient declaration so we don't pull @types/node just for this.
declare const process: { env: Record<string, string | undefined> };

// GitHub Pages serves the site under /<repo>/, so the build needs a matching
// base path. Locally (dev/preview) we keep "/" so routing stays simple.
const base = process.env.GITHUB_ACTIONS ? "/NextDays/" : "/";

// Production-only Content-Security-Policy.
//
// Notes:
//   * style-src includes 'unsafe-inline' because we use React `style={{...}}`
//     props for per-project task-circle colours (style attributes are
//     covered by style-src in CSP2 and style-src-attr in CSP3).
//   * connect-src covers Supabase REST, Auth, Realtime, and Edge Functions
//     — they all share the *.supabase.co domain.
//   * frame-ancestors only takes effect when served as an HTTP response
//     header (not via meta), and GitHub Pages doesn't let us set headers.
//     We include it anyway as documentation of intent; if we ever move to
//     a host that supports headers (Cloudflare/Netlify), copy this string
//     into a _headers file.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const cspPlugin = (): Plugin => ({
  name: "nextdays-csp",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace(
      "<!-- %NEXTDAYS_CSP% -->",
      `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
  },
});

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), cspPlugin()],
  publicDir: "public",
  server: {
    port: 5173,
  },
});
