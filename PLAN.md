# Sodium - Lightweight Game Server Control Panel

> A lightweight, Docker-based game server management panel inspired by Pterodactyl.
> Icon: Feather (🪶) | Design: Modern, Dark, Solid, Simple

---

## 📁 Project Structure

```
sodium/
├── src/
│   ├── bundler/                    # Build system (from Hawk)
│   │   ├── rollup.js
│   │   ├── html-plugin.js
│   │   └── watch.js
│   │
│   ├── components/                 # UI Components
│   │   ├── components.js           # Component registry
│   │   ├── icon.js                 # Feather icon component
│   │   ├── nav.js                  # Navigation bar
│   │   ├── sidebar.js              # Admin sidebar
│   │   ├── modal.js                # Modal dialogs
│   │   ├── table.js                # Data tables
│   │   ├── toast.js                # Notifications
│   │   ├── dropdown.js             # Dropdown menus
│   │   ├── tabs.js                 # Tab panels
│   │   ├── progress.js             # Progress bars
│   │   └── context-menu.js         # Right-click menus
│   │
│   ├── routes/                     # Frontend routes
│   │   ├── routes.js               # Route definitions
│   │   │
│   │   ├── auth/                   # Authentication
│   │   │   ├── login.js
│   │   │   └── register.js
│   │   │
│   │   ├── dashboard/              # User Dashboard
│   │   │   └── index.js
│   │   │
│   │   ├── server/                 # Server Management
│   │   │   ├── index.js            # Server list
│   │   │   ├── console.js          # Live console
│   │   │   ├── files.js            # File manager
│   │   │   ├── databases.js        # Database manager
│   │   │   ├── schedules.js        # Task scheduler
│   │   │   ├── users.js            # Subusers
│   │   │   ├── backups.js          # Backup manager
│   │   │   ├── network.js          # Ports/Allocations
│   │   │   ├── startup.js          # Startup config
│   │   │   └── settings.js         # Server settings
│   │   │
│   │   └── admin/                  # Admin Panel
│   │       ├── index.js            # Admin dashboard
│   │       ├── servers.js          # All servers
│   │       ├── users.js            # User management
│   │       ├── nodes.js            # Node management
│   │       ├── allocations.js      # Port allocations
│   │       ├── eggs.js             # Egg management
│   │       ├── nests.js            # Nest/categories
│   │       └── settings.js         # Global settings
│   │
│   ├── styles/                     # Stylesheets
│   │   ├── main.scss               # Entry point
│   │   ├── _variables.scss         # CSS variables
│   │   ├── _base.scss              # Base styles
│   │   ├── _components.scss        # Component styles
│   │   ├── _layout.scss            # Layout styles
│   │   ├── _file-manager.scss      # File manager styles
│   │   ├── _console.scss           # Console styles
│   │   └── _admin.scss             # Admin panel styles
│   │
│   ├── templates/
│   │   └── index.html              # HTML template
│   │
│   ├── utils/                      # Utilities
│   │   ├── api.js                  # API client
│   │   ├── auth.js                 # Auth helpers
│   │   ├── websocket.js            # WebSocket client
│   │   ├── format.js               # Formatters (bytes, dates)
│   │   ├── icons.js                # Icon definitions
│   │   └── constants.js            # App constants
│   │
│   ├── main.js                     # Entry point
│   └── router.js                   # Client router
│
├── server/                         # Backend
│   ├── index.js                    # Express server
│   ├── config.js                   # Configuration
│   │
│   ├── api/                        # API Routes
│   │   ├── auth.js                 # Authentication
│   │   ├── servers.js              # Server management
│   │   ├── nodes.js                # Node management
│   │   ├── allocations.js          # Allocations
│   │   ├── eggs.js                 # Eggs/nests
│   │   ├── files.js                # File operations
│   │   ├── users.js                # User management
│   │   └── admin.js                # Admin endpoints
│   │
│   ├── services/                   # Business Logic
│   │   ├── docker.js               # Docker management
│   │   ├── file-system.js          # File operations
│   │   ├── resources.js            # Resource monitoring
│   │   ├── backup.js               # Backup service
│   │   └── scheduler.js            # Task scheduler
│   │
│   ├── middleware/                 # Express Middleware
│   │   ├── auth.js                 # JWT auth
│   │   ├── admin.js                # Admin check
│   │   └── ratelimit.js            # Rate limiting
│   │
│   ├── models/                     # Data Models
│   │   ├── User.js
│   │   ├── Server.js
│   │   ├── Node.js
│   │   ├── Allocation.js
│   │   ├── Egg.js
│   │   └── Nest.js
│   │
│   └── websocket/                  # WebSocket Handlers
│       ├── console.js              # Console streaming
│       ├── stats.js                # Resource stats
│       └── files.js                # File transfers
│
├── daemon/                         # Node Daemon (optional separate process)
│   ├── index.js                    # Daemon entry
│   ├── docker.js                   # Docker controller
│   ├── filesystem.js               # FS operations
│   └── monitor.js                  # Resource monitor
│
├── eggs/                           # Egg definitions
│   ├── minecraft/
│   │   ├── vanilla.json
│   │   ├── paper.json
│   │   └── forge.json
│   ├── source/
│   │   ├── csgo.json
│   │   └── gmod.json
│   └── voice/
│       └── mumble.json
│
├── data/                           # Runtime data
│   ├── sodium.db                   # SQLite database
│   ├── servers/                    # Server data
│   └── backups/                    # Backup storage
│
├── dist/                           # Build output
├── public/                         # Static assets
│   └── icons/
│
├── app.build.js                    # Rollup config
├── package.json
├── config.json
└── README.md
```

---

## 🎨 Design System

### Color Palette (Dark Theme)
```scss
:root {
  // Backgrounds
  --bg-primary: #0a0a0a;           // Main background
  --bg-secondary: #111111;         // Cards, panels
  --bg-tertiary: #1a1a1a;          // Hover states
  --bg-elevated: #222222;          // Modals, dropdowns
  
  // Accent (Sodium Blue)
  --accent: #3b82f6;               // Primary accent
  --accent-hover: #2563eb;         // Hover state
  --accent-muted: rgba(59, 130, 246, 0.15);
  
  // Text
  --text-primary: #f5f5f5;         // Main text
  --text-secondary: #a1a1a1;       // Muted text
  --text-tertiary: #6b6b6b;        // Disabled text
  
  // Borders
  --border: #2a2a2a;               // Default border
  --border-hover: #3a3a3a;         // Hover border
  
  // Status Colors
  --success: #22c55e;              // Online, success
  --warning: #f59e0b;              // Warning, starting
  --danger: #ef4444;               // Error, offline
  --info: #3b82f6;                 // Info, installing
  
  // Shadows
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

### Typography
```scss
// Font Stack
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

// Sizes
--text-xs: 0.75rem;    // 12px
--text-sm: 0.875rem;   // 14px
--text-base: 1rem;     // 16px
--text-lg: 1.125rem;   // 18px
--text-xl: 1.25rem;    // 20px
--text-2xl: 1.5rem;    // 24px
```

### Component Patterns
- **Cards**: Solid background, subtle border, 8px radius
- **Buttons**: Solid fill, 6px radius, subtle hover effect
- **Inputs**: Dark background, visible border on focus
- **Tables**: Striped rows, sticky header
- **Modals**: Centered, backdrop blur, slide-in animation

---

## 🔧 Core Features

### 1. Server Management
```
┌─────────────────────────────────────────────────────────────┐
│ 🪶 Sodium                           [Dashboard] [Admin] [◯] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your Servers                                    [+ Create] │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ● Minecraft Server         192.168.1.10:25565          ││
│  │   Paper 1.20.4 • 2GB RAM • Node-1                      ││
│  │   [Console] [Files] [Settings]           ▶ Start       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ○ CS2 Server               192.168.1.10:27015          ││
│  │   Source • 4GB RAM • Node-1                            ││
│  │   [Console] [Files] [Settings]           ▶ Start       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. File Manager
```
┌─────────────────────────────────────────────────────────────┐
│ 📁 /home/container                                          │
├─────────────────────────────────────────────────────────────┤
│ [⬆ Upload] [📁 New Folder] [📄 New File] [⋮ More]           │
├────────┬────────────────────────┬──────────┬───────────────┤
│ ☐      │ Name                   │ Size     │ Modified      │
├────────┼────────────────────────┼──────────┼───────────────┤
│ ☐ 📁   │ plugins/               │ -        │ 2 hours ago   │
│ ☐ 📁   │ world/                 │ -        │ 5 mins ago    │
│ ☐ 📁   │ logs/                  │ -        │ 1 day ago     │
│ ☐ 📄   │ server.properties      │ 1.2 KB   │ 3 hours ago   │
│ ☐ 📄   │ server.jar             │ 45.2 MB  │ 1 week ago    │
│ ☐ 📦   │ backup-2024.tar.gz     │ 128 MB   │ 2 days ago    │
└────────┴────────────────────────┴──────────┴───────────────┘

Right-click Menu:
┌──────────────────┐
│ 📋 Copy          │
│ ✂️ Cut           │
│ 📝 Rename        │
│ 📥 Download      │
│ 📦 Compress      │
│ 📂 Extract       │
│ 🗑️ Delete        │
└──────────────────┘
```

**File Manager Features:**
- File size display (human readable: KB, MB, GB)
- Compress files/folders to `.zip` or `.tar.gz`
- Extract `.zip`, `.tar.gz`, `.tar`, `.rar`, `.7z`
- Move files (drag & drop or cut/paste)
- Rename files/folders
- Multi-select with checkboxes
- Bulk operations (delete, move, compress)
- File preview (text, images, logs)
- Monaco-based code editor
- Upload with progress indicator
- Create files/folders
- Breadcrumb navigation

### 3. Console
```
┌─────────────────────────────────────────────────────────────┐
│ Console                              [▶ Start] [⏹ Stop] [🔄]│
├─────────────────────────────────────────────────────────────┤
│ [2024-01-15 14:32:01] Server starting...                    │
│ [2024-01-15 14:32:05] Loading plugins...                    │
│ [2024-01-15 14:32:08] [WorldGuard] WorldGuard 7.0.9 enabled │
│ [2024-01-15 14:32:10] Done (9.234s)! Type "help" for help   │
│ [2024-01-15 14:35:22] Player123 joined the game             │
│                                                             │
│ CPU: ████████░░ 78%    RAM: ██████░░░░ 1.6/2.0 GB           │
├─────────────────────────────────────────────────────────────┤
│ > say Hello World_                                          │
└─────────────────────────────────────────────────────────────┘
```

### 4. Startup Configuration
```
┌─────────────────────────────────────────────────────────────┐
│ Startup Configuration                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Startup Command                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{JAR_FILE}}  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Variables                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SERVER_MEMORY    │ 2048              │ Server RAM (MB)  │ │
│ │ JAR_FILE         │ server.jar        │ JAR file name    │ │
│ │ MINECRAFT_VER    │ 1.20.4            │ Minecraft version│ │
│ │ BUILD_TYPE       │ paper ▼           │ Server type      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Docker Image: ghcr.io/sodium/yolks:java_21                  │
│                                               [Save Changes]│
└─────────────────────────────────────────────────────────────┘
```

### 5. Admin Panel - Nodes
```
┌─────────────────────────────────────────────────────────────┐
│ Admin > Nodes                                    [+ Add Node]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ● Node-1 (Primary)                                      │ │
│ │   FQDN: node1.example.com                               │ │
│ │   Memory: 24/32 GB used │ Disk: 180/500 GB              │ │
│ │   Servers: 12 │ Allocations: 45/100                     │ │
│ │                                          [Manage] [⚙️]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ● Node-2                                                │ │
│ │   FQDN: node2.example.com                               │ │
│ │   Memory: 8/16 GB used │ Disk: 50/250 GB                │ │
│ │   Servers: 5 │ Allocations: 20/50                       │ │
│ │                                          [Manage] [⚙️]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6. Admin Panel - Eggs
```
┌─────────────────────────────────────────────────────────────┐
│ Admin > Eggs                                      [+ New Egg]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Nest: Minecraft ▼                                           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🥚 Paper                                                │ │
│ │    High performance Minecraft server                    │ │
│ │    Image: ghcr.io/sodium/yolks:java_21                  │ │
│ │    Variables: 4 │ Ports: 1                              │ │
│ │                                     [Edit] [Export] [🗑️]│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🥚 Vanilla                                              │ │
│ │    Official Minecraft server                            │ │
│ │    Image: ghcr.io/sodium/yolks:java_21                  │ │
│ │    Variables: 3 │ Ports: 1                              │ │
│ │                                     [Edit] [Export] [🗑️]│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Egg Structure

```json
{
  "meta": {
    "version": "SODIUM_V1",
    "update_url": null
  },
  "name": "Paper",
  "author": "sodium@example.com",
  "description": "High performance Minecraft server fork",
  "features": ["eula", "java_version", "pid_limit"],
  "docker_images": {
    "Java 21": "ghcr.io/sodium/yolks:java_21",
    "Java 17": "ghcr.io/sodium/yolks:java_17",
    "Java 11": "ghcr.io/sodium/yolks:java_11"
  },
  "file_denylist": [],
  "startup": "java -Xms128M -Xmx{{SERVER_MEMORY}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}",
  "config": {
    "files": {
      "server.properties": {
        "parser": "properties",
        "find": {
          "server-port": "{{server.build.default.port}}",
          "server-ip": "0.0.0.0"
        }
      }
    },
    "startup": {
      "done": ")! For help, type "
    },
    "stop": "stop"
  },
  "scripts": {
    "installation": {
      "script": "#!/bin/bash\n# Installation script\ncd /mnt/server\ncurl -o server.jar https://api.papermc.io/...",
      "container": "ghcr.io/sodium/installers:alpine",
      "entrypoint": "bash"
    }
  },
  "variables": [
    {
      "name": "Server Memory",
      "description": "The amount of memory to allocate",
      "env_variable": "SERVER_MEMORY",
      "default_value": "1024",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|integer|min:128"
    },
    {
      "name": "Server Jar File",
      "description": "The name of the server jarfile",
      "env_variable": "SERVER_JARFILE",
      "default_value": "server.jar",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|string"
    },
    {
      "name": "Minecraft Version",
      "description": "Version of Minecraft to use",
      "env_variable": "MINECRAFT_VERSION",
      "default_value": "latest",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|string"
    },
    {
      "name": "Build Number",
      "description": "Paper build number (latest for newest)",
      "env_variable": "BUILD_NUMBER",
      "default_value": "latest",
      "user_viewable": true,
      "user_editable": true,
      "rules": "required|string"
    }
  ]
}
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/login          # User login
POST   /api/auth/register       # User registration
POST   /api/auth/logout         # Logout
GET    /api/auth/user           # Get current user
POST   /api/auth/refresh        # Refresh token
```

### Servers
```
GET    /api/servers                      # List user's servers
POST   /api/servers                      # Create server
GET    /api/servers/:id                  # Get server details
PATCH  /api/servers/:id                  # Update server
DELETE /api/servers/:id                  # Delete server
POST   /api/servers/:id/power            # Power action (start/stop/restart/kill)
GET    /api/servers/:id/resources        # Get resource usage
WS     /api/servers/:id/console          # Console WebSocket
```

### Files
```
GET    /api/servers/:id/files/list       # List directory
GET    /api/servers/:id/files/contents   # Get file contents
POST   /api/servers/:id/files/write      # Write file
POST   /api/servers/:id/files/create     # Create file/folder
POST   /api/servers/:id/files/delete     # Delete files
POST   /api/servers/:id/files/rename     # Rename file
POST   /api/servers/:id/files/copy       # Copy files
POST   /api/servers/:id/files/compress   # Compress files
POST   /api/servers/:id/files/decompress # Extract archive
POST   /api/servers/:id/files/upload     # Upload file
GET    /api/servers/:id/files/download   # Download file
```

### Admin
```
GET    /api/admin/servers        # All servers
GET    /api/admin/users          # All users
GET    /api/admin/nodes          # All nodes
POST   /api/admin/nodes          # Create node
GET    /api/admin/allocations    # All allocations
POST   /api/admin/allocations    # Create allocation
GET    /api/admin/eggs           # All eggs
POST   /api/admin/eggs           # Import egg
GET    /api/admin/nests          # All nests
```

---

## 🐳 Docker Integration

### Container Management
```javascript
// Create container from egg
async function createServerContainer(server, egg) {
  const container = await docker.createContainer({
    Image: egg.docker_images[server.docker_image],
    name: `sodium-${server.uuid}`,
    Env: buildEnvironment(server, egg),
    HostConfig: {
      Memory: server.memory * 1024 * 1024,
      CpuQuota: server.cpu * 1000,
      DiskQuota: server.disk * 1024 * 1024,
      Binds: [`${server.dataPath}:/home/container`],
      PortBindings: buildPortBindings(server.allocations),
      NetworkMode: 'sodium_network'
    },
    WorkingDir: '/home/container',
    User: '1000:1000',
    Tty: true,
    OpenStdin: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true
  });
  
  return container;
}
```

### Resource Limits
```javascript
const resourceLimits = {
  memory: 2048,        // MB
  swap: 0,             // MB (0 = disabled)
  cpu: 100,            // % (100 = 1 core)
  disk: 10240,         // MB
  io: 500,             // IO weight
  threads: null,       // CPU threads (null = unlimited)
  oom_disabled: false  // Allow OOM killer
};
```

---

## 📊 Resource Monitoring

Real-time stats via WebSocket:
```javascript
{
  "cpu_absolute": 45.2,           // % of allocated CPU
  "memory_bytes": 1073741824,     // Current memory usage
  "memory_limit_bytes": 2147483648,
  "disk_bytes": 5368709120,       // Disk usage
  "network_rx_bytes": 102400,     // Network received
  "network_tx_bytes": 51200,      // Network transmitted
  "uptime": 3600000,              // Uptime in ms
  "state": "running"              // running, starting, stopping, offline
}
```

---

## 🔒 Security

### Authentication
- JWT tokens with refresh mechanism
- Password hashing with bcrypt (cost 12)
- Rate limiting on auth endpoints
- Session management

### Authorization
- Role-based access (user, admin, superadmin)
- Server-level permissions (subusers)
- API key support for automation

### Server Isolation
- Docker container isolation
- User namespacing
- Network isolation per server
- File system permissions (chroot-like)

---

## 💾 Database Configuration

Sodium uses **SQLite** as the primary database for simplicity and portability.

### Database Modes

```javascript
// config.json
{
  "database": {
    "driver": "sqlite",           // sqlite | mysql | postgres (future)
    "sqlite": {
      "path": "./data/sodium.db",
      "wal_mode": true,           // Write-Ahead Logging for better performance
      "busy_timeout": 5000,       // Wait 5s if database is locked
      "cache_size": 2000          // Pages to cache in memory
    }
  }
}
```

### SQLite Service
```javascript
// server/services/database.js
import Database from 'better-sqlite3';

class DatabaseService {
  constructor(config) {
    this.db = new Database(config.sqlite.path, {
      verbose: config.debug ? console.log : null
    });
    
    if (config.sqlite.wal_mode) {
      this.db.pragma('journal_mode = WAL');
    }
    this.db.pragma(`busy_timeout = ${config.sqlite.busy_timeout}`);
    this.db.pragma(`cache_size = ${config.sqlite.cache_size}`);
    
    this.migrate();
  }
  
  migrate() {
    // Run migrations from server/migrations/
  }
  
  prepare(sql) {
    return this.db.prepare(sql);
  }
  
  transaction(fn) {
    return this.db.transaction(fn);
  }
}

export default DatabaseService;
```

### Migration System
```
server/migrations/
├── 001_create_users.sql
├── 002_create_nodes.sql
├── 003_create_allocations.sql
├── 004_create_eggs.sql
├── 005_create_servers.sql
├── 006_create_backups.sql
└── 007_create_schedules.sql
```

### Dependencies
```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  }
}
```

---

## 📋 Database Schema

### Users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME,
  updated_at DATETIME
);
```

### Servers
```sql
CREATE TABLE servers (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name TEXT,
  owner_id INTEGER REFERENCES users(id),
  node_id INTEGER REFERENCES nodes(id),
  egg_id INTEGER REFERENCES eggs(id),
  memory INTEGER,
  disk INTEGER,
  cpu INTEGER,
  allocation_id INTEGER REFERENCES allocations(id),
  status TEXT DEFAULT 'offline',
  startup_command TEXT,
  docker_image TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### Nodes
```sql
CREATE TABLE nodes (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  name TEXT,
  fqdn TEXT,
  scheme TEXT DEFAULT 'https',
  daemon_port INTEGER DEFAULT 8080,
  memory INTEGER,
  memory_overallocate INTEGER DEFAULT 0,
  disk INTEGER,
  disk_overallocate INTEGER DEFAULT 0,
  upload_size INTEGER DEFAULT 100,
  created_at DATETIME
);
```

### Allocations
```sql
CREATE TABLE allocations (
  id INTEGER PRIMARY KEY,
  node_id INTEGER REFERENCES nodes(id),
  ip TEXT,
  port INTEGER,
  server_id INTEGER REFERENCES servers(id),
  is_primary INTEGER DEFAULT 0,
  notes TEXT,
  UNIQUE(node_id, ip, port)
);
```

### Eggs
```sql
CREATE TABLE eggs (
  id INTEGER PRIMARY KEY,
  uuid TEXT UNIQUE,
  nest_id INTEGER REFERENCES nests(id),
  name TEXT,
  description TEXT,
  docker_images TEXT,  -- JSON
  startup TEXT,
  config TEXT,         -- JSON
  scripts TEXT,        -- JSON
  variables TEXT,      -- JSON
  created_at DATETIME
);
```

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run watch

# Production build
npm run build

# Start server
npm start

# Fast build (no cache)
npm run fast-build
```

---

## 🗓️ Implementation Phases

### Phase 1: Foundation
- [x] Project setup with Hawk bundler
- [x] Basic routing and layout
- [x] Authentication system
- [x] Database setup (SQLite)
- [x] Base component library

### Phase 2: Server Core
- [x] Server creation/management
- [x] Docker integration
- [x] Console (WebSocket)
- [x] Power actions
- [x] Resource monitoring

### Phase 3: File Manager
- [x] Directory listing
- [x] File viewing/editing
- [x] Upload/download
- [x] Compress/decompress
- [x] Bulk operations

### Phase 4: Admin Panel
- [x] Node management
- [x] Allocation system
- [x] User management
- [x] Egg management
- [x] Global settings

### Phase 5: Node Daemon Architecture
- [x] Daemon service (runs on each node)
  - [x] Node daemon entry point
  - [x] JWT authentication with panel
  - [x] Docker container management
  - [x] File system operations
  - [x] Console streaming via WebSocket
  - [x] Resource monitoring (CPU, RAM, Disk, Network)
  - [x] Backup execution
  - [x] Server installation scripts
- [x] Panel-Daemon communication
  - [x] REST API for commands (start, stop, kill, reinstall)
  - [x] WebSocket for real-time data (console, stats)
  - [x] Secure token exchange
  - [x] Health checks and heartbeat
  - [x] Automatic reconnection
- [x] Node configuration
  - [x] Auto-generated daemon config from panel
  - [x] SSL/TLS support
  - [x] Transfer server (migrate servers between nodes)
- [x] Multi-node support
  - [x] Node selection on server creation
  - [x] Load balancing suggestions
  - [x] Cross-node server migration
  - [x] Centralized logging

### Phase 6: Advanced Features
- [x] Backups
- [x] Schedules
- [x] Subusers
- [x] Databases
- [x] API keys

### Phase 7: Polish
- [ ] UI animations
- [ ] Mobile responsiveness
- [ ] Documentation
- [ ] Testing
- [ ] Performance optimization

---

## 🪶 Branding

**Name**: Sodium  
**Icon**: Feather (lightweight, fast)  
**Tagline**: "Lightweight Game Server Management"  
**Colors**: Dark theme with blue accent (#3b82f6)

The feather represents:
- Lightweight nature
- Speed and agility
- Clean, minimal design
- Writing/control (like a quill)
