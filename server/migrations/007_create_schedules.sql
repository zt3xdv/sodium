-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  is_active INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,
  last_run DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedules_server ON schedules(server_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(is_active);

-- Schedule tasks table (for multi-step schedules)
CREATE TABLE IF NOT EXISTS schedule_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  payload TEXT,
  time_offset INTEGER DEFAULT 0,
  UNIQUE(schedule_id, sequence)
);
