-- Backups table
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  UNIQUE(server_id, file_name)
);

CREATE INDEX IF NOT EXISTS idx_backups_server ON backups(server_id);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
