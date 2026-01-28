# Sodium Panel

Modern game server management panel.

## Features

- Game Server Management - Deploy and manage game servers
- Code Editor - Built-in editor with syntax highlighting (CodeMirror 6)
- Web Terminal - Full terminal access (xterm.js)
- User Authentication - JWT-based authentication
- Modern UI - Responsive dark theme
- Real-time Updates - WebSocket-powered

## Installation

```bash
git clone https://github.com/zt3xdv/sodium.git
cd sodium
npm install
npm run build
npm start
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

## Tech Stack

- **Backend**: Express.js 5, WebSockets
- **Frontend**: Vanilla JS, SCSS, Rollup
- **Editor**: CodeMirror 6
- **Terminal**: xterm.js

## Related

- [Sodium Reaction](https://github.com/zt3xdv/sodium-reaction) - Node daemon for Sodium Panel

## License

[MIT](LICENSE)
