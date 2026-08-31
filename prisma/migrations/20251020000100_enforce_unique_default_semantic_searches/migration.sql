-- Deduplicate existing default semantic searches prior to adding a unique constraint
-- Keep the earliest created record for each (userId, category, title, isDefault=true)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "userId", category, title, "isDefault"
           ORDER BY "createdAt" ASC
         ) AS rn
  FROM "SemanticSearch"
  WHERE "isDefault" = TRUE
)
DELETE FROM "SemanticSearch" s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Add the unique constraint if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'SemanticSearch'
      AND c.conname = 'user_category_title_isDefault_unique'
  ) THEN
    ALTER TABLE "SemanticSearch"
    ADD CONSTRAINT user_category_title_isDefault_unique
      UNIQUE ("userId", category, title, "isDefault");
  END IF;
END $$;
