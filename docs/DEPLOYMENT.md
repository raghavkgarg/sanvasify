# Local Development & Database Guide

## Overview

This guide covers setting up Sanvasify for local development, managing the database, and configuring authentication.

For cloud deployment instructions, please refer to **[CloudDeploymentPlan.MD](CloudDeploymentPlan.MD)**.

## Prerequisites

- Go 1.25+ (for building)

## Build & Run Locally

```bash


# Build the fetcher tool
go build -o dist/fetch ./cmd/fetch

# Build the loader tool
go build -o dist/load ./cmd/load
./dist/load
./dist/load -file data/nav_reports/nav_data_2025-10-01_to_2026-01-19.parquet

# Build the server
go build -o sanvasify ./cmd/server

# Build the secret generator
go build -o dist/gensecret ./cmd/gensecret
```

## Configuration

### 1. Configure OAuth

Follow the [Authentication Setup](AUTHENTICATION.md) guide to:
- Create Google OAuth client ID
- Create GitHub OAuth app
- Update redirect URLs to production domain

### 2. Update Configuration

Edit `config/Config.toml` (ensure paths are relative for local dev):

```toml
use_db = true
db_path = "./sanvasify.db"
log_file = "./sanvasify.log"

[server]
port = 8080

[fetcher]
enabled = false
data_dir = "./data/nav_reports"

[auth]
enabled = true
jwt_secret = ""  # Set via environment variable
jwt_expiry_hours = 24

[auth.google]
client_id = "your-google-client-id"
client_secret = ""  # Set via environment variable
redirect_url = "http://localhost:8080/api/auth/callback/google"

[auth.github]
client_id = "your-github-client-id"
client_secret = ""  # Set via environment variable
redirect_url = "http://localhost:8080/api/auth/callback/github"
```

### 7. Set Environment Variables

Create `/opt/sanvasify/.env`:

```bash
JWT_SECRET="your-generated-secret"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxx"
GITHUB_CLIENT_SECRET="your-github-secret"
```

Set permissions:
```bash
sudo chmod 600 /opt/sanvasify/.env
sudo chown sanvasify:sanvasify /opt/sanvasify/.env
```

## Systemd Service

### Create Service File

Create `/etc/systemd/system/sanvasify.service`:

```ini
[Unit]
Description=Sanvasify Mutual Fund Analysis Server
After=network.target

[Service]
Type=simple
User=sanvasify
Group=sanvasify
WorkingDirectory=/opt/sanvasify
EnvironmentFile=/opt/sanvasify/.env
ExecStart=/opt/sanvasify/bin/sanvasify
Restart=on-failure
RestartSec=5s

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/sanvasify/data /opt/sanvasify/logs

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable sanvasify
sudo systemctl start sanvasify
sudo systemctl status sanvasify
```

### View Logs

```bash
# Systemd logs
sudo journalctl -u sanvasify -f

# Application logs
sudo tail -f /opt/sanvasify/logs/sanvasify.log
```

## Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/sanvasify`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Sanvasify
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files (optional optimization)
    location /static/ {
        alias /opt/sanvasify/web/static/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/sanvasify /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Data Management

### Initial Data Load

```bash
# Run fetcher to download historical data
cd /opt/sanvasify/bin
sudo -u sanvasify ./fetch

# Verify data
sudo -u sanvasify ls -lh /opt/sanvasify/data/nav_reports/
```

### Scheduled Data Updates

Create cron job for daily updates:

```bash
sudo crontab -u sanvasify -e
```

Add:
```cron
# Fetch NAV data daily at 8 PM
0 20 * * * cd /opt/sanvasify/bin && ./fetch >> /opt/sanvasify/logs/fetch.log 2>&1
```

Update config for incremental fetching:
```toml
[fetcher]
from_date = "2026-01-26"  # Update daily
to_date = "2026-01-26"
```

## Monitoring

### Health Check Endpoint

Add to your monitoring system:
```bash
curl -f http://localhost:8080/api/schemes || exit 1
```

### Log Rotation

Create `/etc/logrotate.d/sanvasify`:

```
/opt/sanvasify/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0640 sanvasify sanvasify
    postrotate
        systemctl reload sanvasify > /dev/null 2>&1 || true
    endscript
}
```

### Disk Space Monitoring

Monitor database and log sizes:
```bash
du -sh /opt/sanvasify/data/
du -sh /opt/sanvasify/logs/
```

## Backup

### Database Backup

Create backup script `/opt/sanvasify/bin/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/sanvasify/backups"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR
cp /opt/sanvasify/data/sanvasify.db $BACKUP_DIR/sanvasify-$DATE.db
gzip $BACKUP_DIR/sanvasify-$DATE.db

# Keep last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

Schedule daily backups:
```bash
sudo crontab -u sanvasify -e
```

Add:
```cron
# Backup database daily at 2 AM
0 2 * * * /opt/sanvasify/bin/backup.sh
```

## Security

### Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to app port
sudo ufw deny 8080/tcp

# Enable firewall
sudo ufw enable
```

### Security Headers (Nginx)

Add to Nginx config:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

### Secrets Management

- Never commit secrets to git
- Use environment variables for all secrets
- Restrict `.env` file permissions (600)
- Rotate secrets periodically
- Use secret management service (AWS Secrets Manager, HashiCorp Vault, etc.)

## Troubleshooting

### Service won't start

```bash
# Check service status
sudo systemctl status sanvasify

# Check logs
sudo journalctl -u sanvasify -n 50

# Check permissions
ls -la /opt/sanvasify/bin/sanvasify
ls -la /opt/sanvasify/data/
```

### Database errors

```bash
# Check database file
sudo -u sanvasify duckdb /opt/sanvasify/data/sanvasify.db -c "SELECT COUNT(*) FROM sif_schemes"

# Check disk space
df -h /opt/sanvasify/data/
```

### OAuth errors

- Verify redirect URLs match exactly
- Check HTTPS is enabled
- Verify secrets are set correctly
- Check OAuth app settings in Google/GitHub

### Performance issues

- Check database size and indexes
- Monitor CPU/memory usage: `htop`
- Check Nginx access logs for traffic patterns
- Consider adding caching layer

## Updates

### Update Application

```bash
# Build new version
GOOS=linux GOARCH=amd64 go build -o sanvasify ./cmd/server

# Copy to server
scp sanvasify user@server:/tmp/

# On server
sudo systemctl stop sanvasify
sudo cp /tmp/sanvasify /opt/sanvasify/bin/
sudo chown sanvasify:sanvasify /opt/sanvasify/bin/sanvasify
sudo systemctl start sanvasify
```

### Update Configuration

```bash
# Edit config
sudo nano /opt/sanvasify/config/Config.toml

# Restart service
sudo systemctl restart sanvasify
```

## Multi-Server Deployment

For high availability:

1. **Load Balancer**: Use Nginx/HAProxy to distribute traffic
2. **Shared Database**: Use network-accessible DuckDB or migrate to PostgreSQL
3. **Session Storage**: Use Redis for JWT token blacklist
4. **File Storage**: Use shared storage (NFS, S3) for Parquet files

## Cloud Deployment

### AWS

- EC2 instance for application
- RDS for database (if migrating from DuckDB)
- S3 for Parquet files
- ALB for load balancing
- Route 53 for DNS
- ACM for SSL certificates

### Google Cloud

- Compute Engine for application
- Cloud SQL for database
- Cloud Storage for Parquet files
- Cloud Load Balancing
- Cloud DNS

### Azure

- Virtual Machines for application
- Azure Database for PostgreSQL
- Blob Storage for Parquet files
- Application Gateway
- Azure DNS

## Container Deployment

See separate Docker/Kubernetes deployment guide (coming soon).
