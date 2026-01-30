# Architecture

## Overview

Sodium is a game server management panel that communicates with Sodium Reaction daemons to manage servers across nodes.

```
┌─────────────────────────────────────────────────────────────┐
│                      Sodium Panel                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Frontend  │  │   Backend   │  │      Database       │  │
│  │  (Vanilla)  │◄─►│ (Express)   │◄─►│ (File/MySQL/PG/SQL) │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/WebSocket
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │  Sodium   │    │  Sodium   │    │  Sodium   │
   │ Reaction  │    │ Reaction  │    │ Reaction  │
   │  Node 1   │    │  Node 2   │    │  Node N   │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │
         ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │  Docker   │    │  Docker   │    │  Docker   │
   │ Containers│    │ Containers│    │ Containers│
   └───────────┘    └───────────┘    └───────────┘
```

## Components

### Panel

- **Frontend**: Vanilla JavaScript SPA with SCSS
  - Rollup bundler
  - CodeMirror 6 for file editing
  - xterm.js for terminal

- **Backend**: Express.js 5
  - JWT authentication
  - WebSocket proxy for console
  - Multi-database support (File, MySQL, PostgreSQL, SQLite)

### Sodium Reaction

Go daemon (fork of Pterodactyl Wings) that handles:

- Server lifecycle (start, stop, restart)
- File management
- Console I/O
- Resource monitoring
- Backups
- SFTP access

**Paths:**
- Config: `/etc/sodium/config.yml`
- Data: `/var/sodium/volumes`
- Backups: `/var/sodium/backups`
- User: `sodium`

## Data Flow

### Server Creation

1. User submits creation request
2. Panel validates limits and resources
3. Panel finds available node
4. Panel sends request to Sodium Reaction
5. Daemon creates Docker container
6. Panel stores metadata

### Console Access

1. User opens console
2. Frontend connects to `/ws/console`
3. Panel authenticates and verifies permissions
4. Panel connects to daemon WebSocket
5. Messages proxied between user and daemon

## Database

Sodium supports multiple database backends:

| Backend | Driver | Use Case |
|---------|--------|----------|
| File (default) | Built-in | Development, small deployments |
| MySQL/MariaDB | `mysql2` | Production, existing MySQL infrastructure |
| PostgreSQL | `pg` | Production, complex queries |
| SQLite | `better-sqlite3` | Single-server production |

The database is configured via environment variables (`DB_TYPE`, `DB_HOST`, etc.). See [Configuration](configuration.md) for details.

## Database Schema

### Users

```javascript
{
  id, username, password, displayName, bio, avatar, links,
  isAdmin, limits: {servers, memory, disk, cpu},
  settings: {theme, notifications, privacy}
}
```

### Nodes

```javascript
{
  id, name, description, location_id, fqdn, scheme,
  memory, disk, daemon_port, daemon_sftp_port,
  daemon_token, daemon_token_id, maintenance_mode,
  allocation_start, allocation_end
}
```

### Servers

```javascript
{
  id, uuid, name, user_id, node_id, egg_id,
  docker_image, startup, limits, environment,
  allocation, allocations, status, suspended, subusers
}
```

### Eggs

```javascript
{
  id, nest_id, name, docker_images, docker_image,
  startup, config, install_script, install_container,
  install_entrypoint, variables
}
```
