# Sodium Documentation

## Table of Contents

1. [Installation](installation.md) - Setup guide for the panel
2. [Configuration](configuration.md) - Panel and database configuration
3. [Daemon Setup](daemon-setup.md) - Setting up Sodium Reaction on nodes
4. [API Reference](api.md) - REST API documentation
5. [Architecture](architecture.md) - System architecture overview

## Quick Start

```bash
git clone https://github.com/sodiumpanel/panel.git
cd sodium && npm install && npm run build && npm start
```

On first launch, a **setup wizard** guides you through:
- Panel name, URL, and port
- Database selection (File, SQLite, MySQL, PostgreSQL)
- Optional Redis configuration
- Default user resource limits
- Admin account creation

All configuration is stored in `data/config.json`.

## Database Support

Sodium supports multiple database backends:

- **File** (default) - No setup required
- **MySQL / MariaDB** - Install `mysql2` package
- **PostgreSQL** - Install `pg` package
- **SQLite** - Install `better-sqlite3` package

See [Configuration](configuration.md#database) for setup instructions.

## Related Projects

- [Sodium Panel](https://github.com/sodiumpanel/panel) - Web management panel (this repository)
- [Sodium Reaction](https://github.com/sodiumpanel/panel-reaction) - Node daemon for managing game servers
