CREATE TABLE public.our_days_records (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX our_days_records_prefix ON public.our_days_records (key text_pattern_ops);
ALTER TABLE public.our_days_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.our_days_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.our_days_records TO service_role;
