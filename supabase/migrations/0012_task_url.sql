-- One optional link per task.
--
-- Nullable with no default, so every pre-existing row starts with no URL.
-- Values are normalised client-side to an absolute http(s) URL before they
-- are written (see src/lib/extractUrl.ts); the column itself is plain text.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS url text;
