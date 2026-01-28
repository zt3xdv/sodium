# Installation

## Requirements

- Node.js 18 or higher
- npm

## Panel Installation

Clone the repository:

```bash
git clone https://github.com/zt3xdv/sodium.git
cd sodium
```

Install dependencies:

```bash
npm install
```

Build the frontend:

```bash
npm run build
```

Set environment variables (recommended for production):

```bash
export JWT_SECRET="your-secure-secret-key"
export PORT=3000
```

Start the server:

```bash
npm start
```

The panel will be available at `http://localhost:3000`.

## First User

The first user to register automatically becomes an administrator.

## Production Deployment

### Using systemd

Create `/etc/systemd/system/sodium.service`:

```ini
[Unit]
Description=Sodium Panel
After=network.target

[Service]
Type=simple
User=sodium
WorkingDirectory=/opt/sodium
Environment=NODE_ENV=production
Environment=JWT_SECRET=your-secure-secret-key
Environment=PORT=3000
ExecStart=/usr/bin/node src/server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable sodium
sudo systemctl start sodium
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Directory Structure

```
sodium/
├── data/              # Database and configuration (gitignored)
│   ├── sodium.db      # Binary database file
│   └── config.json    # Panel configuration
├── dist/              # Built frontend assets
├── src/
│   ├── server/        # Backend (Express.js)
│   └── ...            # Frontend source
└── assets/            # Static assets
```
