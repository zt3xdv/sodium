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

On first launch, a setup wizard will guide you through:

1. **Panel Configuration** - Name, URL, and port
2. **Database** - File (default), SQLite, MySQL, or PostgreSQL
3. **Redis** - Optional, for large-scale deployments
4. **Default Limits** - Resource limits for new users
5. **Admin Account** - Create the first administrator

All configuration is stored in `data/config.json`. No manual environment variables required.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run build` | Build frontend |
| `npm run fast` | Quick build |
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
