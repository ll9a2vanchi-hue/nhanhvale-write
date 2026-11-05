-- Per-article review opt-out; existing articles continue to participate.
ALTER TABLE public.write_topics ADD COLUMN IF NOT EXISTS no_review boolean NOT NULL DEFAULT false;
