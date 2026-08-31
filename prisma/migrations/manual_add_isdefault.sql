-- Migration: Add isDefault field to SemanticSearch table
-- Date: 2025-10-19
-- Description: Adds isDefault boolean field to track default semantic searches

-- Add isDefault column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'SemanticSearch' 
        AND column_name = 'isDefault'
    ) THEN
        ALTER TABLE "SemanticSearch" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Column isDefault added successfully';
    ELSE
        RAISE NOTICE 'Column isDefault already exists';
    END IF;
END $$;

-- Optional: Remove embedding column if it exists (not needed as embeddings are stored in examples JSON)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'SemanticSearch' 
        AND column_name = 'embedding'
    ) THEN
        ALTER TABLE "SemanticSearch" DROP COLUMN "embedding";
        RAISE NOTICE 'Column embedding removed successfully';
    ELSE
        RAISE NOTICE 'Column embedding does not exist';
    END IF;
END $$;
