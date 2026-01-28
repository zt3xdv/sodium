# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | (default) | Secret key for JWT tokens |

## Panel Configuration

Configuration is stored in `data/config.json` and can be edited through Admin > Settings.

### Default Configuration

```json
{
  "panel": {
    "name": "Sodium Panel",
    "url": "http://localhost:3000"
  },
  "registration": {
    "enabled": true
  },
  "defaults": {
    "servers": 2,
    "memory": 2048,
    "disk": 10240,
    "cpu": 200
  },
  "features": {
    "subusers": true
  }
}
```

### Options

**panel**
- `name` - Panel display name
- `url` - Public URL (used for daemon communication)

**registration**
- `enabled` - Allow new user registrations

**defaults** - Default limits for new users:
- `servers` - Maximum servers
- `memory` - Maximum RAM (MB)
- `disk` - Maximum disk (MB)
- `cpu` - Maximum CPU (100 = 1 core)

**features**
- `subusers` - Enable server sharing

## Database

Sodium uses a binary database format in `data/sodium.db` containing users, nodes, servers, nests, eggs, and locations.
