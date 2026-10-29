-- Preserve all records and permissions; only add query indexes.
CREATE INDEX IF NOT EXISTS our_days_posts_created_id
  ON public.our_days_records ((value->>'created') DESC, (value->>'id') DESC)
  WHERE key LIKE 'posts/%';
CREATE INDEX IF NOT EXISTS our_days_posts_author
  ON public.our_days_records ((value->>'author'))
  WHERE key LIKE 'posts/%';
CREATE INDEX IF NOT EXISTS our_days_records_entry
  ON public.our_days_records ((value->>'entry'))
  WHERE key LIKE 'comments/%' OR key LIKE 'hugs/%';
CREATE INDEX IF NOT EXISTS our_days_posts_visibility
  ON public.our_days_records USING gin (value jsonb_path_ops)
  WHERE key LIKE 'posts/%';
