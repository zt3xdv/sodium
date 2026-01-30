# Sodium Panel

A modern control panel which is built to be lightweight and easy to install. File-based database by default, with optional MySQL, PostgreSQL, and SQLite support for production.

## Installation

```bash
git clone https://github.com/zt3xdv/sodium.git
cd sodium
npm install
npm run build
npm start
```

### Optional: External Database

```bash
# MySQL
npm install mysql2
export DB_TYPE=mysql DB_HOST=localhost DB_NAME=sodium DB_USER=sodium DB_PASS=password

# PostgreSQL
npm install pg
export DB_TYPE=postgresql DB_HOST=localhost DB_NAME=sodium DB_USER=sodium DB_PASS=password

# SQLite
npm install better-sqlite3
export DB_TYPE=sqlite
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run build` | Build frontend |
| `npm run fast-build` | Quick build |
| `npm run watch` | Development mode |

## Documentation

See [docs/](docs/) for full documentation:

- [Installation](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Daemon Setup](docs/daemon-setup.md)
- [API Reference](docs/api.md)
- [Architecture](docs/architecture.md)
- [Eggs](eggs/)

## Related

- [Sodium Reaction](https://github.com/zt3xdv/sodium-reaction) - Node daemon for Sodium Panel

## License

[MIT](LICENSE)

<!-- test push -->
