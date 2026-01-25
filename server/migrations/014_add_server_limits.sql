-- Add per-server resource limits
ALTER TABLE servers ADD COLUMN limit_databases INTEGER DEFAULT 0;
ALTER TABLE servers ADD COLUMN limit_backups INTEGER DEFAULT 0;
ALTER TABLE servers ADD COLUMN limit_allocations INTEGER DEFAULT 1;
