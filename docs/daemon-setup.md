# Daemon Setup

Sodium uses [Sodium Reaction](https://github.com/zt3xdv/sodium-reaction) as the daemon for managing game servers on nodes. Sodium Reaction is a fork of Pterodactyl Wings with Sodium-specific paths and configuration.

## Prerequisites

On the node server:

- Docker
- Linux (Ubuntu 20.04+ recommended)
- Root access

## Step 1: Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
```

## Step 2: Install Sodium Reaction

Download the latest release:

```bash
sudo mkdir -p /etc/sodium
curl -L -o /usr/local/bin/wings "https://github.com/zt3xdv/sodium-reaction/releases/latest/download/wings_linux_$([ "$(uname -m)" == "x86_64" ] && echo "amd64" || echo "arm64")"
sudo chmod +x /usr/local/bin/wings
```

## Step 3: Create Location and Node in Panel

1. Log in to Sodium as admin
2. Go to Admin > Locations and create a location
3. Go to Admin > Nodes and create a new node:
   - **Name**: Your node name
   - **Location**: Select location
   - **FQDN**: Domain or IP of your node
   - **Scheme**: `https` (recommended) or `http`
   - **Daemon Port**: `8080`
   - **SFTP Port**: `2022`
   - **Memory**: Total RAM (MB)
   - **Disk**: Total disk (MB)

## Step 4: Configure the Daemon

After creating the node, click on it and go to Configuration tab.

### Auto Deploy

Click "Deploy Command" and run the command on your node. This creates the config and restarts the daemon.

### Manual Configuration

Save the config to `/etc/sodium/config.yml`:

```yaml
debug: false
uuid: "your-node-uuid"
token_id: "your-token-id"
token: "your-token"
api:
  host: "0.0.0.0"
  port: 8080
  ssl:
    enabled: true
    cert: "/etc/letsencrypt/live/node.example.com/fullchain.pem"
    key: "/etc/letsencrypt/live/node.example.com/privkey.pem"
  upload_limit: 100
system:
  root_directory: "/var/sodium"
  log_directory: "/var/sodium/logs"
  data: "/var/sodium/volumes"
  archive_directory: "/var/sodium/archives"
  backup_directory: "/var/sodium/backups"
  tmp_directory: "/tmp/sodium"
  username: "sodium"
  sftp:
    bind_port: 2022
docker:
  network:
    name: "sodium_nw"
    interfaces:
      v4:
        subnet: "172.50.0.0/16"
        gateway: "172.50.0.1"
remote: "https://panel.example.com"
allowed_origins:
  - "*"
```

## Step 5: Create systemd Service

Create `/etc/systemd/system/wings.service`:

```ini
[Unit]
Description=Sodium Reaction Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/sodium
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings --config /etc/sodium/config.yml
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable wings
sudo systemctl start wings
```

## Step 6: Verify

Check node status in Admin > Nodes. The node should show as online.

View logs:

```bash
sudo journalctl -u wings -f
```

## SSL Certificates

For HTTPS with Let's Encrypt:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d node.example.com
```

## Firewall

```bash
sudo ufw allow 8080/tcp   # API
sudo ufw allow 2022/tcp   # SFTP
sudo ufw allow 25565:25665/tcp  # Game ports
```

## Differences from Pterodactyl Wings

| Feature | Pterodactyl Wings | Sodium Reaction |
|---------|-------------------|-----------------|
| Config path | `/etc/pterodactyl/config.yml` | `/etc/sodium/config.yml` |
| Data directory | `/var/lib/pterodactyl` | `/var/sodium` |
| System user | `pterodactyl` | `sodium` |
| Docker network | `pterodactyl_nw` | `sodium_nw` |

## Troubleshooting

### Connection issues

1. Check daemon status: `systemctl status wings`
2. Check logs: `journalctl -u wings -f`
3. Verify panel URL is accessible from node
4. Check firewall rules

### Docker issues

```bash
sudo systemctl status docker
sudo docker network create --driver bridge sodium_nw
```
