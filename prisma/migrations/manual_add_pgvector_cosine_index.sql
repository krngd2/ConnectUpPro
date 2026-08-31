-- Add pgvector index for cosine distance similarity search
-- This dramatically improves performance for semantic search queries
-- Using HNSW (Hierarchical Navigable Small World) algorithm for fast approximate nearest neighbor search

-- Note: This may take a few minutes to build on large comment tables
-- You can monitor progress with: SELECT * FROM pg_stat_progress_create_index;

-- Create HNSW index for cosine distance operations
-- m: maximum number of connections per layer (default 16, higher = better recall, slower build)
-- ef_construction: size of dynamic candidate list (default 64, higher = better recall, slower build)
set statement_timeout = '10min';
CREATE INDEX IF NOT EXISTS comment_embedding_cosine_hnsw_idx 
ON "Comment" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: If you prefer IVFFlat (faster to build, slightly less accurate)
-- Uncomment the following and comment out the HNSW index above:
-- CREATE INDEX IF NOT EXISTS comment_embedding_cosine_ivfflat_idx 
-- ON "Comment" 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- To use this index, run:
-- psql -d your_database_url < prisma/migrations/manual_add_pgvector_cosine_index.sql

-- Or in your database client:
-- Execute the CREATE INDEX command directly

-- Performance notes:
-- - HNSW is recommended for production (better accuracy)
-- - IVFFlat is faster to build but may be less accurate
-- - Index will be used automatically for queries with embedding <=> operator
-- - You can verify index usage with EXPLAIN ANALYZE on your queries
