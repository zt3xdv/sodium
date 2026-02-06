<p align="center">
  <img src="assets/banner.png" alt="Sodium Panel" width="600">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/sodiumpanel/panel/releases"><img src="https://img.shields.io/github/v/release/sodiumpanel/panel?include_prereleases" alt="Release"></a>
  <a href="https://github.com/sodiumpanel/panel/issues"><img src="https://img.shields.io/github/issues/sodiumpanel/panel" alt="Issues"></a>
  <a href="https://github.com/sodiumpanel/panel/stargazers"><img src="https://img.shields.io/github/stars/sodiumpanel/panel" alt="Stars"></a>
</p>

<p align="center">
  A modern, lightweight control panel for game server management.<br>
  Easy to install. File-based database by default, with optional MySQL, PostgreSQL, and SQLite support.
</p>

---

> **Beta Software** - This project is under active development. Some features may be incomplete or contain bugs. [Report issues here](https://github.com/sodiumpanel/panel/issues).

## Why Sodium?

| Feature | Sodium | Others |
|---------|--------|--------|
| **Lightweight** | Minimal resource usage | Heavy dependencies |
| **Easy Setup** | Single command install | Complex configuration |
| **No .env files** | JSON config, setup wizard | Manual environment setup |
| **Flexible Database** | File, SQLite, MySQL, PostgreSQL | Usually MySQL only |
| **Modern Stack** | Node.js | PHP, older tech |

## Quick Start

```bash
git clone https://github.com/sodiumpanel/panel.git
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

- [Sodium Reaction](https://github.com/sodiumpanel/reaction) - Node daemon for Sodium Panel

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

- Found a bug? [Open an issue](https://github.com/sodiumpanel/panel/issues)
- Have an idea? [Start a discussion](https://github.com/sodiumpanel/panel/discussions)

## License

[MIT](LICENSE) - Feel free to use, modify, and distribute.

---

<p align="center">
  <sub>Built with care by the Sodium team</sub>
</p>
