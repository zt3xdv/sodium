# Sodium

Game Server Management Panel - A lightweight alternative for managing game servers.

## Features

- Multi-server management (Minecraft, Source, Voice servers)
- User authentication and role-based access
- Real-time server console via WebSocket
- Resource monitoring
- Egg-based server configuration

## Installation

```bash
npm install
```

## Configuration

Edit `config.json` to configure:
- Server port and host
- Database path
- JWT secret (change in production!)
- Daemon settings
- Resource limits

## Usage

```bash
# Development
npm run dev

# Production
npm start

# Build frontend
npm run build

# Watch mode for development
npm run watch
```

## Project Structure

```
sodium/
├── src/           # Frontend source
├── server/        # Backend API
├── daemon/        # Server daemon
├── eggs/          # Server configurations
├── data/          # Database and server data
├── dist/          # Compiled frontend
└── public/        # Static assets
```

## License

MIT
