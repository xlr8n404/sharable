-- Add location fields to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8);

-- Create index for location queries
CREATE INDEX IF NOT EXISTS posts_location_idx ON posts(location_name);
