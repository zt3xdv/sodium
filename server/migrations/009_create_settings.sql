CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('panel_name', '"Sodium"'),
  ('language', '"en"'),
  ('session_timeout', '60'),
  ('max_login_attempts', '5'),
  ('lockout_duration', '15'),
  ('docker_socket', '"/var/run/docker.sock"'),
  ('docker_network', '"sodium_network"');
