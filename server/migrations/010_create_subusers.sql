-- Subusers table
CREATE TABLE IF NOT EXISTS subusers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subusers_server ON subusers(server_id);
CREATE INDEX IF NOT EXISTS idx_subusers_user ON subusers(user_id);
