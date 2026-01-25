CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fqdn TEXT NOT NULL,
  scheme TEXT DEFAULT 'http' CHECK(scheme IN ('http', 'https')),
  daemon_port INTEGER DEFAULT 8080,
  memory INTEGER NOT NULL,
  memory_overallocate INTEGER DEFAULT 0,
  disk INTEGER NOT NULL,
  disk_overallocate INTEGER DEFAULT 0,
  upload_size INTEGER DEFAULT 100,
  daemon_token TEXT,
  behind_proxy INTEGER DEFAULT 0,
  maintenance_mode INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nodes_uuid ON nodes(uuid);
CREATE INDEX IF NOT EXISTS idx_nodes_fqdn ON nodes(fqdn);
