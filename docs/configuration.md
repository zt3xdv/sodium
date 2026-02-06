# Configuration

## Overview

Sodium stores all configuration in `data/config.json`. This file is created automatically by the setup wizard on first launch.

**Note:** Environment variables are no longer used for configuration. All settings are managed through the setup wizard or Admin > Settings.

## Configuration File

### Full Structure

```json
{
  "installed": true,
  "panel": {
    "name": "Sodium",
    "url": "http://localhost:3000",
    "port": 3000
  },
  "jwt": {
    "secret": "auto-generated-secret"
  },
  "database": {
    "type": "file",
    "host": "localhost",
    "port": 3306,
    "name": "sodium",
    "user": "sodium",
    "password": ""
  },
  "redis": {
    "enabled": false,
    "host": "localhost",
    "port": 6379,
    "password": ""
  },
  "registration": {
    "enabled": true
  },
  "defaults": {
    "servers": 2,
    "memory": 2048,
    "disk": 10240,
    "cpu": 200,
    "allocations": 5
  },
  "features": {
    "subusers": true
  }
}
```

### Configuration Options

**panel**
- `name` - Panel display name (shown in browser title and header)
- `url` - Public URL (used for daemon communication and webhooks)
- `port` - Server listening port

**jwt**
- `secret` - JWT signing secret (auto-generated during setup, do not edit)

**database**
- `type` - Database backend: `file`, `sqlite`, `mysql`, `mariadb`, `postgresql`
- `host` - Database host (for mysql/postgresql)
- `port` - Database port (3306 for MySQL, 5432 for PostgreSQL)
- `name` - Database name
- `user` - Database username
- `password` - Database password

**redis**
- `enabled` - Enable Redis caching
- `host` - Redis server host
- `port` - Redis server port
- `password` - Redis password (optional)

**registration**
- `enabled` - Allow new user registrations

**defaults** - Default limits for new users:
- `servers` - Maximum servers
- `memory` - Maximum RAM (MB)
- `disk` - Maximum disk (MB)
- `cpu` - Maximum CPU (100 = 1 core)
- `allocations` - Maximum port allocations

**features**
- `subusers` - Enable server sharing

## Database

Sodium supports multiple database backends:

| Type | Driver | Use Case |
|------|--------|----------|
| `file` | Built-in | Default, no setup required |
| `sqlite` | `better-sqlite3` | Single-server production |
| `mysql` / `mariadb` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |
| `postgresql` | `pg` | PostgreSQL 12+ |

### Installing Database Drivers

If using an external database, install the required driver:

```bash
# MySQL / MariaDB
npm install mysql2

# PostgreSQL
npm install pg

# SQLite
npm install better-sqlite3
```

### Fallback Behavior

If the configured external database is unavailable, Sodium will automatically fall back to the file-based database and log a warning.

## Changing Configuration

### Via Admin Panel

Most settings can be changed through **Admin > Settings** in the web interface.

### Manual Edit

You can directly edit `data/config.json`. Restart the server for changes to take effect.

**Important:** Do not modify `jwt.secret` after setup, as this will invalidate all existing user sessions.

### Re-running Setup

To re-run the setup wizard:

1. Stop the server
2. Delete or edit `data/config.json` and set `"installed": false`
3. Start the server
4. Navigate to `/setup`

**Warning:** This will not delete existing data, but creating a new admin account will add another user.
