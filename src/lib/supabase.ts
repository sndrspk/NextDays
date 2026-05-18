import { createClient } from "@supabase/supabase-js";
import { devWarn } from "./log";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Treat empty strings as missing too: GitHub Actions inlines `""` for an
// unset secret, which would otherwise reach createClient and throw
// `TypeError: Invalid URL` at module load, blanking the page.
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  devWarn(
    "Supabase env vars missing. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or set them as GitHub Actions secrets for the deploy).",
  );
}

export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "public-anon-key",
);
