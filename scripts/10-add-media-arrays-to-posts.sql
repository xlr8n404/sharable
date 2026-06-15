-- Add media_urls and media_types columns to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS media_urls TEXT[],
ADD COLUMN IF NOT EXISTS media_types TEXT[];

-- Create index for media queries
CREATE INDEX IF NOT EXISTS posts_media_urls_idx ON posts USING GIN(media_urls);
