-- Add status tracking for nodes
ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline'));
ALTER TABLE nodes ADD COLUMN last_seen_at DATETIME;
