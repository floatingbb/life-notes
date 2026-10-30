-- Server-only queries. Viewer identity is supplied by the signed-session backend.
CREATE OR REPLACE FUNCTION public.our_days_memory_page(
 p_viewer text,p_limit integer DEFAULT 31,p_cursor_created text DEFAULT NULL,p_cursor_id text DEFAULT NULL,
 p_month text DEFAULT 'all',p_search text DEFAULT '',p_author text DEFAULT '',p_favorites boolean DEFAULT false)
RETURNS TABLE(value jsonb) LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT p.value FROM public.our_days_records p
 WHERE p.key LIKE 'posts/%' AND p.value->>'deleted' IS NULL
 AND (p.value->>'author'=p_viewer OR p.value->>'scope'='family' OR (p.value->>'scope'='selected' AND p.value->'recipients' ? p_viewer))
 AND (p_author='' OR p.value->>'author'=p_author)
 AND (p_search='' OR strpos(lower(coalesce(p.value->>'body','')),lower(p_search))>0)
 AND (NOT p_favorites OR EXISTS(SELECT 1 FROM public.our_days_records f WHERE f.key='favorites/'||p_viewer||'/'||(p.value->>'id') AND f.value->>'active'='true'))
 AND (p_month='all' OR to_char((p.value->>'created')::timestamptz AT TIME ZONE 'Asia/Shanghai','YYYY-MM')=p_month)
 AND (p_cursor_created IS NULL OR (p.value->>'created',p.value->>'id')<(p_cursor_created,p_cursor_id))
 ORDER BY p.value->>'created' DESC,p.value->>'id' DESC LIMIT least(greatest(p_limit,1),31)
$$;
CREATE OR REPLACE FUNCTION public.our_days_memory_months(p_viewer text,p_search text DEFAULT '',p_author text DEFAULT '',p_favorites boolean DEFAULT false)
RETURNS TABLE(month text) LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT DISTINCT to_char((p.value->>'created')::timestamptz AT TIME ZONE 'Asia/Shanghai','YYYY-MM') AS month
 FROM public.our_days_records p
 WHERE p.key LIKE 'posts/%' AND p.value->>'deleted' IS NULL
 AND (p.value->>'author'=p_viewer OR p.value->>'scope'='family' OR (p.value->>'scope'='selected' AND p.value->'recipients' ? p_viewer))
 AND (p_author='' OR p.value->>'author'=p_author)
 AND (p_search='' OR strpos(lower(coalesce(p.value->>'body','')),lower(p_search))>0)
 AND (NOT p_favorites OR EXISTS(SELECT 1 FROM public.our_days_records f WHERE f.key='favorites/'||p_viewer||'/'||(p.value->>'id') AND f.value->>'active'='true'))
 ORDER BY month DESC
$$;
CREATE OR REPLACE FUNCTION public.our_days_activity(p_viewer text,p_since text,p_until text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
 WITH allowed AS (
  SELECT value FROM public.our_days_records WHERE key LIKE 'posts/%' AND value->>'deleted' IS NULL
  AND (value->>'author'=p_viewer OR value->>'scope'='family' OR (value->>'scope'='selected' AND value->'recipients' ? p_viewer))
 ), events AS (
  SELECT 'post' AS kind,p.value->>'id' AS entry,p.value->>'author' AS author,coalesce(p.value->>'sharedAt',p.value->>'created') AS created,NULL::text AS id
  FROM allowed p WHERE p.value->>'author'<>p_viewer AND coalesce(p.value->>'sharedAt',p.value->>'created')>p_since AND coalesce(p.value->>'sharedAt',p.value->>'created')<=p_until
  UNION ALL
  SELECT 'reply',c.value->>'entry',c.value->>'author',c.value->>'created',c.value->>'id'
  FROM public.our_days_records c JOIN allowed p ON p.value->>'id'=c.value->>'entry'
  WHERE c.key LIKE 'comments/%' AND p.value->>'author'=p_viewer AND c.value->>'author'<>p_viewer AND c.value->>'created'>p_since AND c.value->>'created'<=p_until
 ) SELECT jsonb_build_object('newPosts',(SELECT count(*) FROM events WHERE kind='post'),'newReplies',(SELECT count(*) FROM events WHERE kind='reply'),'items',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM events ORDER BY created DESC,id DESC NULLS LAST LIMIT 30)e),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.our_days_memory_page(text,integer,text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.our_days_memory_months(text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.our_days_activity(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.our_days_memory_page(text,integer,text,text,text,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.our_days_memory_months(text,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.our_days_activity(text,text,text) TO service_role;
CREATE INDEX IF NOT EXISTS our_days_comment_activity ON public.our_days_records ((value->>'created'),(value->>'entry')) WHERE key LIKE 'comments/%';
