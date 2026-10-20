-- Read-only comparison for a quiet backup/restore window. Outputs counts and
-- aggregate hashes, never row contents, pass tokens, or password hashes.
-- Run with the same timezone on source and recovery databases.
SET TIME ZONE 'UTC';
SET search_path = pg_catalog;
WITH manifests AS (
  SELECT schemaname, tablename,
    query_to_xml(format(
      'SELECT count(*) AS rows, md5(coalesce(string_agg(md5(to_jsonb(r)::text), '''' ORDER BY md5(to_jsonb(r)::text)), '''')) AS digest FROM %I.%I r',
      schemaname, tablename), false, true, '') AS result
  FROM pg_tables
  WHERE schemaname IN ('public', 'private')
     OR (schemaname = 'auth' AND tablename IN ('users', 'identities'))
     OR (schemaname = 'storage' AND tablename IN ('buckets', 'objects'))
)
SELECT schemaname, tablename,
  (xpath('/row/rows/text()', result))[1]::text AS rows,
  (xpath('/row/digest/text()', result))[1]::text AS digest
FROM manifests ORDER BY schemaname, tablename;

-- RLS flags and policy definitions must also match; data alone is insufficient.
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE schemaname IN ('public', 'private') ORDER BY schemaname, tablename;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'private')
ORDER BY schemaname, tablename, policyname;
