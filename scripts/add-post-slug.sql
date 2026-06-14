-- Add slug column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT 'post';

-- Create unique constraint for slug per user
ALTER TABLE posts
ADD CONSTRAINT posts_user_id_slug_unique UNIQUE (user_id, slug);

-- Create index for faster slug lookups
CREATE INDEX IF NOT EXISTS posts_user_id_slug_idx ON posts(user_id, slug);

-- Update existing posts with a default slug based on their post_number
-- This ensures all existing posts have unique slugs
UPDATE posts
SET slug = 'post-' || post_number
WHERE slug = 'post';
