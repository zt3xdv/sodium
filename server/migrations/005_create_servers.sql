CREATE TABLE IF NOT EXISTS servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  egg_id INTEGER NOT NULL REFERENCES eggs(id) ON DELETE RESTRICT,
  allocation_id INTEGER REFERENCES allocations(id) ON DELETE SET NULL,
  memory INTEGER NOT NULL,
  disk INTEGER NOT NULL,
  cpu INTEGER DEFAULT 100,
  swap INTEGER DEFAULT 0,
  io INTEGER DEFAULT 500,
  status TEXT DEFAULT 'offline' CHECK(status IN ('offline', 'starting', 'running', 'stopping', 'installing', 'error')),
  startup_command TEXT,
  docker_image TEXT,
  environment TEXT,
  installed INTEGER DEFAULT 0,
  suspended INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servers_uuid ON servers(uuid);
CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_node ON servers(node_id);
CREATE INDEX IF NOT EXISTS idx_servers_egg ON servers(egg_id);
