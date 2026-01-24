CREATE TABLE IF NOT EXISTS nests (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default nests
INSERT OR IGNORE INTO nests (uuid, name, description) VALUES
  ('a1234567-1234-1234-1234-123456789001', 'Minecraft', 'Minecraft Java and Bedrock servers'),
  ('a1234567-1234-1234-1234-123456789002', 'Source Engine', 'Source engine based games (CS2, Gmod, etc)'),
  ('a1234567-1234-1234-1234-123456789003', 'Voice Servers', 'Voice communication servers');
