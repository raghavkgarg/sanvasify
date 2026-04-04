# Cloud Deployment Plan for Sanvasify

**CRITICAL: Disaster Recovery & Complete Fresh Instance Guide**

---

## PREREQUISITES & INSTANCE DETAILS

### Current Instance Information
- **Instance Type**: AWS EC2
- **Instance Name**: ip-172-31-19-107
- **OS**: Amazon Linux or similar (ARM64-based, Graviton processor)
- **Region**: ap-south-1 (Mumbai)
- **Public IP**: 13.234.173.198
- **Domain**: sanvasify.com
- **VPC Security Group**: Must allow ports 80/TCP, 443/TCP, 22/TCP (SSH)

### Local Development Machine Requirements
- macOS with Homebrew
- Go 1.20+ (Cross-compilation support for ARM64)
- Cross-compiler for ARM64: `aarch64-linux-gnu-gcc` (via Homebrew)
- SSH key: `sn1.pem` (stored securely, permissions: 400)
- SCP capability for file transfer

### Server Base Requirements
```bash
# On fresh EC2 instance (Amazon Linux 2):
sudo yum update -y
sudo yum install -y git curl wget nc duckdb net-tools openssh-clients

# Verify ARM64 architecture (should show aarch64)
uname -m

# Verify Go is available if not building locally
go version  # if Go needed on server for compilation
```

---

## Phase 1: Build Binary (Local Machine)

Since the target server appears to be AWS Graviton (ARM64), you must cross-compile from your local machine.

**Terminal Command:**
```bash
# Navigate to project root
cd sanvasify

# Build for Linux ARM64
# Note: CGO_ENABLED=1 is usually required for SQLite/DuckDB. 
# Ensure you have a cross-compiler (like musl-cross) if building on macOS.
CC=aarch64-linux-gnu-gcc \
CXX=aarch64-linux-gnu-g++ \
CGO_ENABLED=1 \
GOOS=linux \
GOARCH=arm64 \
go build -ldflags "-s -w" -o sanvasify cmd/server/main.go
```

## Phase 2: Upload Artifacts (Local Machine)

Upload the necessary files to the EC2 user's home directory (staging area).

**Terminal Command:**
```bash
KEY="sn1.pem"
HOST="ec2-user@13.234.173.198"
BASE_DIR="/Users/raghavgarg/Projects/myGo/sanvasify"
DB_FILE="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"

# 1. Upload Binary
scp -i "$KEY" "$BASE_DIR/sanvasify" $HOST:~/

# 2. Upload Database (Only if seeding a new DB, otherwise skip to avoid overwrite)
scp -i "$KEY" "$DB_FILE" $HOST:~/

# 3. Upload Caddy Config
scp -i "$KEY" "$BASE_DIR/Caddyfile" $HOST:~/

# 4. Upload Web Assets
scp -i "$KEY" -r "$BASE_DIR/web" $HOST:~/

# 5. Upload App Config
scp -i "$KEY" -r "$BASE_DIR/config" $HOST:~/

# 6. Upload Environment Secrets (OAuth, JWT secrets)
scp -i "$KEY" "$BASE_DIR/.env" $HOST:~/


## Phase 3: Server Deployment (Remote Machine - FRESH INSTANCE FROM SCRATCH)

Login first: `ssh -i "sn1.pem" ec2-user@13.234.173.198`

### 3.0 Fresh Instance Initialization (CRITICAL FIRST STEPS)

Run these ONLY on a brand new EC2 instance before anything else:

```bash
# Update system packages
sudo yum update -y
sudo yum upgrade -y

# Install all required packages at once
sudo yum install -y \
    git curl wget nc htop duckdb \
    net-tools openssh-clients \
    gcc make openssl-devel

# Verify DuckDB is installed
duckdb --version

# Create application user that will run Sanvasify
sudo useradd -r -s /bin/false sanvasify

# Create directory structure with proper ownership from scratch
sudo mkdir -p /opt/sanvasify/{bin,data,config,web/static/{css,js,images}}
sudo chown -R sanvasify:sanvasify /opt/sanvasify
sudo chmod -R 750 /opt/sanvasify

# Create Caddy user/group
sudo groupadd --system caddy 2>/dev/null || true
sudo useradd --system \
    --gid caddy \
    --create-home \
    --home-dir /var/lib/caddy \
    --shell /usr/sbin/nologin \
    --comment "Caddy web server" \
    caddy 2>/dev/null || true

# Create persistent Caddy data directory
sudo mkdir -p /var/lib/caddy
sudo chown -R caddy:caddy /var/lib/caddy
sudo chmod 700 /var/lib/caddy

# Create Caddy config directory
sudo mkdir -p /etc/caddy
sudo chmod 755 /etc/caddy
```

### 3.1 One-Time Setup (Run Once)

Only run these if setting up a fresh server.

```bash
# 1. Create directory structure (if not already done in 3.0)
sudo mkdir -p /opt/sanvasify/{bin,data,config,web}
sudo mkdir -p /etc/caddy

# 2. Create service user (if not already done)
sudo useradd -r -s /bin/false sanvasify 2>/dev/null || true
sudo groupadd --system caddy 2>/dev/null || true

# 3. Install Caddy (ARM64)
CADDY_VERSION="v2.7.6"
wget https://github.com/caddyserver/caddy/releases/download/${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_arm64.tar.gz
tar -xzf caddy_${CADDY_VERSION}_linux_arm64.tar.gz
sudo mv caddy /usr/local/bin/
sudo chmod +x /usr/local/bin/caddy
rm caddy_${CADDY_VERSION}_linux_arm64.tar.gz

# Verify installation
/usr/local/bin/caddy version

# 4. Verify DuckDB is available for database operations
which duckdb
duckdb --version

# 6. Create Systemd Services
cat <<EOF | sudo tee /etc/systemd/system/sanvasify.service
[Unit]
Description=Sanvasify Service
After=network.target

[Service]
Type=simple
User=sanvasify
Group=sanvasify
ExecStart=/opt/sanvasify/bin/sanvasify
WorkingDirectory=/opt/sanvasify
Restart=always
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# Create Caddy Service File
cat <<EOF | sudo tee /etc/systemd/system/caddy.service
[Unit]
Description=Caddy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF


# 5. Set Ownership (Run before enabling services)
sudo chown -R sanvasify:sanvasify /opt/sanvasify
sudo chown root:caddy /etc/caddy

# Reload Daemon and Enable Services
sudo systemctl daemon-reload
sudo systemctl enable sanvasify
sudo systemctl enable caddy
```

### 3.1b DuckDB Database Initialization (CRUCIAL FOR FRESH INSTANCE)

```bash
#  RESTORE from backup 
if [ -f ~/sanvasify.db ]; then
    sudo mkdir -p /opt/sanvasify/data
    sudo cp ~/sanvasify.db /opt/sanvasify/data/sanvasify.db
    sudo chown sanvasify:sanvasify /opt/sanvasify/data/sanvasify.db
    sudo chmod 640 /opt/sanvasify/data/sanvasify.db
    echo "✓ Database restored from backup"
fi

# Verify database file was created
ls -lah /opt/sanvasify/data/sanvasify.db

# Set proper permissions
sudo chown sanvasify:sanvasify /opt/sanvasify/data/sanvasify.db
sudo chmod 640 /opt/sanvasify/data/sanvasify.db
```

### 3.1c Environment Secrets & Configuration Setup

```bash
# Create .env file with required secrets (adjust as needed)
# These should be kept secret and not committed to git
cat <<'EOSQL' | sudo tee /opt/sanvasify/config/.env > /dev/null
# OAuth Credentials (if applicable)
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_here

# Database configuration (if not in Config.toml)
DATABASE_URL=/opt/sanvasify/data/sanvasify.db
DATABASE_TYPE=duckdb

# Application settings
APP_ENV=production
PORT=8080
EOSQL

# Set secure permissions (only readable by sanvasify user)
sudo chown sanvasify:sanvasify /opt/sanvasify/config/.env
sudo chmod 600 /opt/sanvasify/config/.env
```

### 3.2 Routine Deployment Steps

Run these steps for every new update or redeployment.

```bash
# 1. BACKUP CURRENT DATABASE BEFORE ANY CHANGES (CRITICAL)
sudo mkdir -p /opt/sanvasify/backups
sudo cp /opt/sanvasify/data/sanvasify.db \
    /opt/sanvasify/backups/sanvasify.db.backup.$(date +%s)
echo "✓ Database backed up before deployment"

# 2. Stop Services
sudo systemctl stop sanvasify
sudo systemctl stop caddy

# 3. Back up and Replace Binary
[ -f /opt/sanvasify/bin/sanvasify ] && \
    sudo mv /opt/sanvasify/bin/sanvasify /opt/sanvasify/bin/sanvasify.bak.$(date +%s)
sudo mv ~/sanvasify /opt/sanvasify/bin/
sudo chmod +x /opt/sanvasify/bin/sanvasify

# 3. Update Web Assets
if [ -d ~/web ]; then
    sudo rm -rf /opt/sanvasify/web/*
    sudo cp -r ~/web/* /opt/sanvasify/web/
fi


# 4. Update Config
if [ -d ~/config ]; then
    sudo rm -rf /opt/sanvasify/config/*
    sudo cp -r ~/config/* /opt/sanvasify/config/
fi

# 4a. Patch Cloud-Specific Config
# Use sed to set the production database path in the uploaded config file.
sudo sed -i 's|^db_path = .*|db_path = "/opt/sanvasify/data/sanvasify.db"|' /opt/sanvasify/config/Config.toml

# 5. Update Caddy Config
[ -f ~/Caddyfile ] && sudo mv ~/Caddyfile /etc/caddy/Caddyfile

# 6. DATABASE MIGRATION FOR DUCKDB (CRITICAL - Handle with care)
# 
if [ -f ~/sanvasify.db ]; then
    sudo mv ~/sanvasify.db /opt/sanvasify/data/
    # Remove WAL file to prevent corruption on swap
    sudo rm -f /opt/sanvasify/data/sanvasify.db.wal
fi


# 7. Fix Permissions (Critical)
sudo chown -R sanvasify:sanvasify /opt/sanvasify
sudo chmod -R 750 /opt/sanvasify
sudo chmod +x /opt/sanvasify/bin/sanvasify
# Ensure Caddy can read the config
sudo chown root:caddy /etc/caddy/Caddyfile
sudo chmod 644 /etc/caddy/Caddyfile

# 8. Start Services
sudo systemctl daemon-reload
sudo systemctl start sanvasify
sudo systemctl start caddy

# 9. Verification
echo "--- App Status ---"
sudo systemctl status sanvasify --no-pager
echo "--- Caddy Status ---"
sudo systemctl status caddy --no-pager
```

## Phase 4: Post-Deployment Verification

Run these checks immediately after deployment to ensure everything is working.

### 4.1 Database Setup & Verification

```bash
# Check if database file exists and has proper permissions
ls -la /opt/sanvasify/data/sanvasify.db

# Check disk space
df -h /opt/sanvasify/data

# Verify data in the database (requires duckdb cli to be installed)
sudo -u sanvasify duckdb /opt/sanvasify/data/sanvasify.db -c "SELECT COUNT(*) FROM sif_schemes"

# If database doesn't exist, the app should create it on first run.
# Monitor the logs to see if DB initialization was successful
sudo journalctl -u sanvasify -n 20 --no-pager

# Verify database permissions (sanvasify user must have write access)
sudo chown -R sanvasify:sanvasify /opt/sanvasify/data/
sudo chmod 750 /opt/sanvasify/data/
```

### 4.2 Environment Variables & Configuration

```bash
# Verify config file is in place
ls -la /opt/sanvasify/config/

# Check the current configuration (if safe to display)
cat /opt/sanvasify/config/Config.toml | head -20

# Verify the app can read the config
sudo -u sanvasify cat /opt/sanvasify/config/Config.toml > /dev/null && echo "Config readable" || echo "Config NOT readable"

# Verify db_path is set for production
grep "db_path" /opt/sanvasify/config/Config.toml
```

### 4.3 Port 8080 Verification

```bash
# Check if app is listening on port 8080
netstat -tlnp | grep 8080
# or
ss -tlnp | grep 8080

# Test local connectivity to the app
curl -s http://localhost:8080/health | head -c 100
```

### 4.4 Health Check & API Test

```bash
# Test the /health endpoint (should be proxied by Caddy)
curl -v http://localhost/health

# Test the domain via localhost (bypass DNS)
curl -v -H "Host: sanvasify.com" http://localhost/

# Check if API is responding
curl -s http://localhost:8080/api/health | jq .
```

### 4.5 Logs & Troubleshooting

```bash
# View Sanvasify app logs (last 50 lines)
sudo journalctl -u sanvasify -n 50 --no-pager -f

# View Caddy logs (last 50 lines)
sudo journalctl -u caddy -n 50 --no-pager -f

# Check for startup errors
sudo systemctl status sanvasify
sudo systemctl status caddy

# If services failed, restart them (requires investigation first)
sudo systemctl restart sanvasify
sudo systemctl restart caddy
```

### 4.6 Firewall & Security Group Verification

```bash
# AWS: Verify security group allows ports 80, 443, 8080 (if debugging)
aws ec2 describe-security-groups --group-ids sg-xxxxx --region ap-south-1

# Or via AWS Console: EC2 → Instances → Security groups → Inbound rules
# Should allow:
#   - HTTP (80) from 0.0.0.0/0
#   - HTTPS (443) from 0.0.0.0/0
#   - Optional: 8080 from localhost only (for debugging)

# Local check: verify ports are open
sudo ufw status
# If UFW is enabled, ensure rules exist:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 4.7 TLS/SSL Configuration

```bash
# Check Caddyfile is properly configured
cat /etc/caddy/Caddyfile

# Verify Caddy can read the config
sudo -u caddy /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile

# Test SSL/TLS certificate generation (if using Let's Encrypt)
sudo journalctl -u caddy -n 100 --no-pager | grep -i "certificate\|ssl\|tls"

# Check Caddy's certificate storage
sudo ls -la /var/lib/caddy/
```

### 4.8 DNS & Domain Verification

```bash
# Verify DNS resolves to EC2 IP
nslookup sanvasify.com
nslookup www.sanvasify.com

# From the EC2 instance:
dig sanvasify.com
dig www.sanvasify.com

# If using Cloudflare, verify:
# 1. DNS records point to EC2 IP (13.234.173.198)
# 2. Cloudflare SSL/TLS is set to "Flexible" or "Full" (not "Full (Strict)" if using self-signed)
# 3. Page Rules and Workers are disabled if not configured
```

### 4.9 End-to-End Test

```bash
# Test from external machine (or browser)
curl -I https://sanvasify.com/check_sif_nav.html
curl -I https://www.sanvasify.com/check_sif_nav.html

# Expected: HTTP 200 OK (not 404 or 502)

# Full content test
curl https://sanvasify.com/check_sif_nav.html | head -20
```
## Phase 5: Troubleshooting Guide

### Issue: 404 Not Found on Static Files

**Cause**: Web assets not uploaded or path misconfigured in Caddyfile.

**Solution**:
```bash
# Verify files exist
ls -la /opt/sanvasify/web/check_sif_nav.html

# Check Caddyfile root path
grep -n "root \*" /etc/caddy/Caddyfile

# Reload Caddy if path was fixed
sudo systemctl reload caddy
```

### Issue: 502 Bad Gateway

**Cause**: Sanvasify app not running or not listening on port 8080.

**Solution**:
```bash
# Check app status
sudo systemctl status sanvasify

# Check if port 8080 is listening
netstat -tlnp | grep 8080

# Restart the app
sudo systemctl restart sanvasify

# Check logs
sudo journalctl -u sanvasify -n 50 --no-pager
```

### Issue: SSL/TLS Certificate Error (Cloudflare Error 525)

**Cause**: Caddy using self-signed cert and Cloudflare SSL set to "Full (Strict)".

**Solution 1: Change Cloudflare SSL Mode**
```
Cloudflare Dashboard → SSL/TLS → Overview → Set to "Flexible"
```

**Solution 2: Get Valid Certificate**
```bash
# Update Caddyfile to use ACME (Let's Encrypt)
# Change: tls internal
# To: tls your-email@example.com

# Reload Caddy
sudo systemctl reload caddy
```

### Issue: Permission Denied on Config/Database

**Cause**: Wrong ownership or permissions on /opt/sanvasify/.

**Solution**:
```bash
sudo chown -R sanvasify:sanvasify /opt/sanvasify
sudo chmod -R 750 /opt/sanvasify
sudo chmod +x /opt/sanvasify/bin/sanvasify

# Restart services
sudo systemctl restart sanvasify
```

### Issue: DuckDB Database Corruption

**Cause**: Server crash or improper shutdown while writing to database.

**Solution**:
```bash
# Check database integrity
sudo -u sanvasify duckdb /opt/sanvasify/data/sanvasify.db -c "PRAGMA integrity_check"

# If corrupted, check for backup
ls -la /opt/sanvasify/backups/sanvasify.db.backup.*

# Restore from backup
sudo cp /opt/sanvasify/backups/sanvasify.db.backup.LATEST /opt/sanvasify/data/sanvasify.db
sudo chown sanvasify:sanvasify /opt/sanvasify/data/sanvasify.db

# Clean up WAL files
sudo rm -f /opt/sanvasify/data/sanvasify.db.wal
sudo rm -f /opt/sanvasify/data/sanvasify.db-shm

# Restart application
sudo systemctl restart sanvasify
```

### Issue: DuckDB "database is locked" Error

**Cause**: Multiple processes accessing DuckDB simultaneously.

**Solution**:
```bash
# Check what processes are using the database
lsof /opt/sanvasify/data/sanvasify.db

# Stop the app
sudo systemctl stop sanvasify

# Remove lock files
sudo rm -f /opt/sanvasify/data/sanvasify.db.lock
sudo rm -f /opt/sanvasify/data/sanvasify.db.wal
sudo rm -f /opt/sanvasify/data/sanvasify.db-shm

# Restart
sudo systemctl start sanvasify
```

### Issue: Caddy Can't Bind to Port 80/443

**Cause**: Another service using ports or insufficient permissions.

**Solution**:
```bash
# Find process using port 80/443
lsof -i :80
lsof -i :443

# Kill conflicting process (if safe)
sudo kill -9 <PID>

# Check security group allows ports
# AWS Console → Security Groups → Verify inbound rules for 80, 443

# Restart Caddy
sudo systemctl restart caddy

# Verify it's running
sudo systemctl status caddy
```


### 6.4 Emergency Commands Reference

```bash
# View real-time application logs
sudo journalctl -u sanvasify -f

# View Caddy logs
sudo journalctl -u caddy -f

# Database health check
sudo -u sanvasify duckdb /opt/sanvasify/data/sanvasify.db -c "SELECT 'OK' AS status"

# Restart stack
sudo systemctl restart sanvasify caddy

# Full server restart
sudo reboot

# Check system resources
top -b -n 1 | head -15
iostat -x 1 5  # I/O statistics

# Network diagnostics
ss -tlnp | grep -E ':(80|443|8080)'
curl -v https://sanvasify.com/health
```

---

## Appendix: File Reference Guide

| File/Path | Purpose | Owner | Permissions |
|-----------|---------|-------|------------|
| `/opt/sanvasify/bin/sanvasify` | Main application binary | sanvasify:sanvasify | 755 |
| `/opt/sanvasify/data/sanvasify.db` | DuckDB database | sanvasify:sanvasify | 640 |
| `/opt/sanvasify/config/Config.toml` | App configuration | sanvasify:sanvasify | 640 |
| `/opt/sanvasify/web/static/*` | Frontend assets | sanvasify:sanvasify | 644 (files), 755 (dirs) |
| `/etc/caddy/Caddyfile` | Web server config | root:caddy | 644 |
| `/var/lib/caddy` | Caddy certificates/data | caddy:caddy | 700 |
| `/etc/systemd/system/sanvasify.service` | Sanvasify service unit | root:root | 644 |
| `/etc/systemd/system/caddy.service` | Caddy service unit | root:root | 644 |

---

## Summary: Fresh Instance Checklist

- [ ] EC2 instance created (ARM64, 20GB+ storage)
- [ ] Security group configured (ports 80, 443, 22)
- [ ] SSH key available locally (sn1.pem)
- [ ] Database backup downloaded locally
- [ ] All config files backed up
- [ ] web/ and config/ directories backed up
- [ ] DNS records updated to new IP
- [ ] Execute disaster recovery script
- [ ] Verify services are running
- [ ] Test application at https://sanvasify.com
- [ ] Verify database has data
- [ ] Set up weekly backup cron job
- [ ] Document new instance details
- [ ] Update monitoring/alerting with new IP