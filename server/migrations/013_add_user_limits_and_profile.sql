-- Add user profile fields and resource limits
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;

-- User resource limits (0 = unlimited)
ALTER TABLE users ADD COLUMN limit_servers INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_memory INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_disk INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_cpu INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_databases INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_backups INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN limit_allocations INTEGER DEFAULT 0;

-- Create index for display_name searches
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
