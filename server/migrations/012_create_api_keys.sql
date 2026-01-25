-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identifier TEXT UNIQUE NOT NULL,
  token_hash TEXT NOT NULL,
  description TEXT,
  allowed_ips TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  last_used_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_identifier ON api_keys(identifier);
