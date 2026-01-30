# Sodium Documentation

## Table of Contents

1. [Installation](installation.md) - Setup guide for the panel
2. [Configuration](configuration.md) - Panel and database configuration
3. [Daemon Setup](daemon-setup.md) - Setting up Sodium Reaction on nodes
4. [API Reference](api.md) - REST API documentation
5. [Architecture](architecture.md) - System architecture overview

## Database Support

Sodium supports multiple database backends:

- **File** (default) - No setup required
- **MySQL / MariaDB** - Install `mysql2` package
- **PostgreSQL** - Install `pg` package
- **SQLite** - Install `better-sqlite3` package

See [Configuration](configuration.md#database) for setup instructions.

## Related Projects

- [Sodium Panel](https://github.com/zt3xdv/sodium) - Web management panel (this repository)
- [Sodium Reaction](https://github.com/zt3xdv/sodium-reaction) - Node daemon for managing game servers
