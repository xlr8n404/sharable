-- Add slug column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create unique index for slug per user (allows NULL for old posts)
CREATE UNIQUE INDEX IF NOT EXISTS posts_user_id_slug_unique 
ON posts(user_id, slug) WHERE slug IS NOT NULL;
