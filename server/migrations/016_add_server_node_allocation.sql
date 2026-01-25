ALTER TABLE servers ADD COLUMN node_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN allocation_id INTEGER REFERENCES allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servers_node ON servers(node_id);
CREATE INDEX IF NOT EXISTS idx_servers_allocation ON servers(allocation_id);
