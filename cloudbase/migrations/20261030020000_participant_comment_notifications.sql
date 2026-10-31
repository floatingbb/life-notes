-- Notify authors and previous participants, once per new comment, without nested replies.
CREATE OR REPLACE FUNCTION public.our_days_activity(p_viewer text,p_since text,p_until text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
 WITH allowed AS (
  SELECT value FROM public.our_days_records WHERE key LIKE 'posts/%' AND value->>'deleted' IS NULL
  AND (value->>'author'=p_viewer OR value->>'scope'='family' OR (value->>'scope'='selected' AND value->'recipients' ? p_viewer))
 ), events AS (
  SELECT 'post' AS kind,p.value->>'id' AS entry,p.value->>'author' AS author,coalesce(p.value->>'sharedAt',p.value->>'created') AS created,NULL::text AS id,NULL::text AS subject
  FROM allowed p WHERE p.value->>'author'<>p_viewer AND coalesce(p.value->>'sharedAt',p.value->>'created')>p_since AND coalesce(p.value->>'sharedAt',p.value->>'created')<=p_until
  UNION ALL
  SELECT 'reply',c.value->>'entry',c.value->>'author',c.value->>'created',c.value->>'id',CASE WHEN p.value->>'author'=p_viewer THEN 'own' ELSE 'participated' END
  FROM public.our_days_records c JOIN allowed p ON p.value->>'id'=c.value->>'entry'
  WHERE c.key LIKE 'comments/%' AND c.value->>'author'<>p_viewer AND c.value->>'created'>p_since AND c.value->>'created'<=p_until
  AND (p.value->>'author'=p_viewer OR EXISTS(
   SELECT 1 FROM public.our_days_records mine
   WHERE mine.key LIKE 'comments/%' AND mine.value->>'entry'=c.value->>'entry'
   AND mine.value->>'author'=p_viewer AND mine.value->>'created'<=c.value->>'created'
  ))
 ) SELECT jsonb_build_object('newPosts',(SELECT count(*) FROM events WHERE kind='post'),'newReplies',(SELECT count(*) FROM events WHERE kind='reply'),'items',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM events ORDER BY created DESC,id DESC NULLS LAST LIMIT 30)e),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.our_days_activity(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.our_days_activity(text,text,text) TO service_role;
CREATE INDEX IF NOT EXISTS our_days_comment_participants ON public.our_days_records ((value->>'author'),(value->>'entry'),(value->>'created')) WHERE key LIKE 'comments/%';
