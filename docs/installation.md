# Installation

## Requirements

- Node.js 23 or higher
- npm
- (Optional) MySQL/MariaDB, PostgreSQL, or SQLite for external database

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

# Optional: Use external database (MySQL, PostgreSQL, or SQLite)
# export DB_TYPE=mysql
# export DB_HOST=localhost
# export DB_PORT=3306
# export DB_NAME=sodium
# export DB_USER=sodium
# export DB_PASS=your-password
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
# Optional: External database
# Environment=DB_TYPE=mysql
# Environment=DB_HOST=localhost
# Environment=DB_NAME=sodium
# Environment=DB_USER=sodium
# Environment=DB_PASS=your-password
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
│   ├── sodium.db      # Binary database file (when using file DB)
│   ├── sodium.sqlite  # SQLite database (when using sqlite)
│   └── config.json    # Panel configuration
├── dist/              # Built frontend assets
├── src/
│   ├── server/        # Backend (Express.js)
│   └── ...            # Frontend source
└── assets/            # Static assets
```

## External Database Setup

If you prefer using an external database instead of the default file-based storage:

### MySQL / MariaDB

```bash
npm install mysql2

# Create database
mysql -u root -p -e "CREATE DATABASE sodium; CREATE USER 'sodium'@'localhost' IDENTIFIED BY 'password'; GRANT ALL ON sodium.* TO 'sodium'@'localhost';"

# Configure
export DB_TYPE=mysql
export DB_HOST=localhost
export DB_NAME=sodium
export DB_USER=sodium
export DB_PASS=password
```

### PostgreSQL

```bash
npm install pg

# Create database
sudo -u postgres psql -c "CREATE DATABASE sodium; CREATE USER sodium WITH PASSWORD 'password'; GRANT ALL PRIVILEGES ON DATABASE sodium TO sodium;"

# Configure
export DB_TYPE=postgresql
export DB_HOST=localhost
export DB_NAME=sodium
export DB_USER=sodium
export DB_PASS=password
```

### SQLite

```bash
npm install better-sqlite3

export DB_TYPE=sqlite
export DB_FILE=./data/sodium.sqlite
```
