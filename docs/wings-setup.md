# Wings Setup

Sodium uses [Pterodactyl Wings](https://github.com/pterodactyl/wings) as the daemon for managing game servers on nodes. You can also use [Sodium Reaction](https://github.com/zt3xdv/sodium-reaction) as an alternative daemon.

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

## Step 2: Install Wings

Download the latest Wings release:

```bash
sudo mkdir -p /etc/pterodactyl
curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$([ "$(uname -m)" == "x86_64" ] && echo "amd64" || echo "arm64")"
sudo chmod +x /usr/local/bin/wings
```

## Step 3: Create Location and Node in Panel

1. Log in to the Sodium panel as admin
2. Go to Admin > Locations and create a location
3. Go to Admin > Nodes and create a new node:
   - Name: Your node name
   - Location: Select the location you created
   - FQDN: The domain or IP of your node server
   - Scheme: `https` (recommended) or `http`
   - Daemon Port: `8080` (default)
   - SFTP Port: `2022` (default)
   - Memory: Total RAM available in MB
   - Disk: Total disk space available in MB

## Step 4: Configure Wings

After creating the node, click on it and go to the Configuration tab. You have two options:

### Option A: Auto Deploy

Click "Deploy Command" and run the provided command on your node server. This will automatically create the configuration file and restart Wings.

### Option B: Manual Configuration

Copy the configuration from the panel and save it to `/etc/pterodactyl/config.yml`:

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
  data: "/var/lib/pterodactyl/volumes"
  sftp:
    bind_port: 2022
docker:
  network:
    name: "pterodactyl_nw"
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
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
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

## Step 6: Verify Connection

Check the node status in the panel under Admin > Nodes. The node should show as online.

View Wings logs:

```bash
sudo journalctl -u wings -f
```

## SSL Certificates

For HTTPS, you need SSL certificates. Using Let's Encrypt:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d node.example.com
```

Update the paths in `/etc/pterodactyl/config.yml`:

```yaml
ssl:
  enabled: true
  cert: "/etc/letsencrypt/live/node.example.com/fullchain.pem"
  key: "/etc/letsencrypt/live/node.example.com/privkey.pem"
```

## Firewall

Open the required ports:

```bash
sudo ufw allow 8080/tcp   # Wings API
sudo ufw allow 2022/tcp   # SFTP
sudo ufw allow 25565:25665/tcp  # Game server ports (adjust range as needed)
```

## Troubleshooting

### Wings not connecting

1. Check if Wings is running: `systemctl status wings`
2. Check logs: `journalctl -u wings -f`
3. Verify the panel URL in config.yml is accessible from the node
4. Check firewall rules

### Token errors

If you see authentication errors, regenerate the node token in the panel and update the config.

### Docker issues

```bash
# Check Docker is running
sudo systemctl status docker

# Create the network manually if needed
sudo docker network create --driver bridge pterodactyl_nw
```
