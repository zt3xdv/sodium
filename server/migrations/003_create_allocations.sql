CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
  is_primary INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(node_id, ip, port)
);

CREATE INDEX IF NOT EXISTS idx_allocations_node ON allocations(node_id);
CREATE INDEX IF NOT EXISTS idx_allocations_server ON allocations(server_id);
