-- Database hosts table
CREATE TABLE IF NOT EXISTS database_hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 3306,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  max_databases INTEGER DEFAULT 0,
  node_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_database_hosts_node ON database_hosts(node_id);

-- Server databases table
CREATE TABLE IF NOT EXISTS server_databases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES database_hosts(id) ON DELETE CASCADE,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  remote TEXT DEFAULT '%',
  max_connections INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(host_id, database_name)
);

CREATE INDEX IF NOT EXISTS idx_server_databases_server ON server_databases(server_id);
CREATE INDEX IF NOT EXISTS idx_server_databases_host ON server_databases(host_id);
