-- Add github_token column to users table
-- Run this SQL directly in your Neon database console

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS github_token VARCHAR(255);

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'github_token';
