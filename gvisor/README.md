# Sodium gVisor Daemon

Lightweight container isolation using gVisor/Bubblewrap for hosting environments like Replit.

## Features

- **gVisor** (runsc) - Google's container runtime with kernel-level isolation
- **Bubblewrap** (bwrap) - Lightweight sandboxing (fallback)
- **Process isolation** - Basic fallback for unsupported systems
- Resource limits (RAM, CPU, Disk, Processes)
- WebSocket console streaming
- Multiple runtime images (JavaScript, Python, TypeScript, etc.)

## Installation

```bash
cd gvisor
npm install
npm run setup    # Downloads gVisor and sets up runtimes
```

## Usage

```bash
# Start daemon
npm start

# Development mode
npm run dev

# Test sandbox
npm test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/sandboxes` | List all sandboxes |
| POST | `/sandboxes` | Create sandbox |
| GET | `/sandboxes/:id` | Get sandbox status |
| POST | `/sandboxes/:id/start` | Start sandbox |
| POST | `/sandboxes/:id/stop` | Stop sandbox |
| POST | `/sandboxes/:id/kill` | Kill sandbox |
| DELETE | `/sandboxes/:id` | Delete sandbox |
| POST | `/sandboxes/:id/input` | Send input |

## WebSocket

Connect to `/console/:sandboxId?token=YOUR_TOKEN` for real-time console.

Messages:
```json
{ "type": "input", "content": "your input" }
{ "type": "start", "command": "node", "args": ["index.js"] }
{ "type": "stop" }
{ "type": "kill" }
```

## Resource Limits

Similar to Pterodactyl:

| Resource | Default | Description |
|----------|---------|-------------|
| memory_mb | 512 | RAM limit in MB |
| cpu_percent | 100 | CPU quota (100 = 1 core) |
| disk_mb | 1024 | Disk quota in MB |
| timeout_seconds | 300 | Max runtime (0 = unlimited) |
| max_processes | 64 | Process limit |
| max_files | 1024 | Open file limit |

## Images

Pre-configured runtime images in `images/`:

- `javascript.json` - Node.js 20
- `python.json` - Python 3.12
- `typescript.json` - TypeScript via Bun
- `deno.json` - Deno runtime
- `bash.json` - Bash scripts

## Isolation Modes

1. **gVisor** (recommended) - Full kernel isolation, requires root
2. **Bubblewrap** - Namespace isolation, works rootless
3. **Process** - Basic isolation, fallback

## Configuration

`config.json`:
```json
{
  "host": "0.0.0.0",
  "port": 8081,
  "token": "your-secret-token",
  "isolation": "bubblewrap",
  "sandboxes_path": "./sandboxes",
  "default_limits": {
    "memory_mb": 512,
    "cpu_percent": 100,
    "disk_mb": 1024
  }
}
```

## Comparison with Docker

| Feature | Docker | gVisor | Bubblewrap |
|---------|--------|--------|------------|
| Isolation | Container | Kernel sandbox | Namespaces |
| Overhead | ~50MB | ~20MB | ~1MB |
| Startup | ~1s | ~100ms | ~10ms |
| Root required | Optional | Yes | No |
| Compatibility | High | Medium | High |

## Architecture

```
┌─────────────────────────────────────┐
│           Sodium Panel              │
└──────────────┬──────────────────────┘
               │ HTTP/WebSocket
┌──────────────▼──────────────────────┐
│         gVisor Daemon               │
│  ┌─────────────────────────────┐    │
│  │        Sandbox.js           │    │
│  │  ┌───────┐ ┌───────┐        │    │
│  │  │gVisor │ │bwrap  │        │    │
│  │  └───┬───┘ └───┬───┘        │    │
│  │      │         │            │    │
│  │  ┌───▼─────────▼───┐        │    │
│  │  │   Sandboxes     │        │    │
│  │  │ ┌────┐ ┌────┐   │        │    │
│  │  │ │ JS │ │ PY │   │        │    │
│  │  │ └────┘ └────┘   │        │    │
│  │  └─────────────────┘        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```
