#!/bin/bash

# switch_db.sh - Switch between sanvasify.db and sanvas.db on the remote AWS instance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure common paths are included
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export TZ='Asia/Kolkata'

# Constants
KEY_FILE="$PROJECT_ROOT/sn1.pem"
INSTANCE_NAME="sanvasify-prod"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

# SSH Options
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o ConnectTimeout=15"

log_info()    { echo -e "${GREEN}>>> [INFO] $1${NC}"; }
log_warn()    { echo -e "${YELLOW}>>> [WARN] $1${NC}"; }
log_error()   { echo -e "${RED}>>> [ERROR] $1${NC}"; }
die()         { log_error "$1"; exit 1; }

usage() {
    echo "Usage: $0 [sanvas|sanvasify]"
    echo "  sanvas     : Switch to /opt/sanvasify/data/sanvas.db"
    echo "  sanvasify  : Switch to /opt/sanvasify/data/sanvasify.db"
    exit 1
}

# Validate argument
if [ "$#" -ne 1 ]; then
    usage
fi

TARGET_DB="$1"
if [ "$TARGET_DB" != "sanvas" ] && [ "$TARGET_DB" != "sanvasify" ]; then
    usage
fi

# Resolve host IP using AWS CLI
resolve_remote_host() {
    log_info "Resolving AWS instance IP for '$INSTANCE_NAME'..."
    local ipv4=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].PublicIpAddress" --output text 2>/dev/null)
    local ipv6=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].NetworkInterfaces[0].Ipv6Addresses[0].Ipv6Address" --output text 2>/dev/null)

    if [ -n "$ipv4" ] && [ "$ipv4" != "None" ]; then
        REMOTE_IP="$ipv4"
    elif [ -n "$ipv6" ] && [ "$ipv6" != "None" ]; then
        REMOTE_IP="$ipv6"
    else
        die "Could not resolve a public IP. Ensure the instance is running and tagged correctly."
    fi
    REMOTE_USER_HOST="ec2-user@$REMOTE_IP"
    log_info "Host resolved to: $REMOTE_IP"
}

# Main Execution
resolve_remote_host

TARGET_DB_FILE="/opt/sanvasify/data/${TARGET_DB}.db"
log_info "Preparing to switch remote database to: $TARGET_DB_FILE"

ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "sudo bash -s" << EOF
    set -e
    
    CONFIG_FILE="/opt/sanvasify/config/Config.toml"
    DATA_DIR="/opt/sanvasify/data"
    
    echo ">>> [REMOTE] Checking config file..."
    if [ ! -f "\$CONFIG_FILE" ]; then
        echo ">>> [REMOTE] Error: Config file not found at \$CONFIG_FILE"
        exit 1
    fi
    
    echo ">>> [REMOTE] Checking if database file exists..."
    if [ ! -f "$TARGET_DB_FILE" ]; then
        echo ">>> [REMOTE] Warning: Target database file $TARGET_DB_FILE does not exist yet."
        echo ">>> [REMOTE] It will be created when the server starts or loader runs."
    else
        echo ">>> [REMOTE] Database file confirmed: $TARGET_DB_FILE"
        ls -lh "$TARGET_DB_FILE"
    fi
    
    echo ">>> [REMOTE] Stopping services..."
    systemctl stop sanvasify caddy
    
    echo ">>> [REMOTE] Updating db_path in \$CONFIG_FILE..."
    # Replace any existing active db_path line in Config.toml
    sed -i 's|^db_path = .*|db_path = "$TARGET_DB_FILE"|' "\$CONFIG_FILE"
    
    # Remove any stale WAL files from the other database to prevent locking issues
    rm -f "\$DATA_DIR"/*.db.wal
    
    echo ">>> [REMOTE] Applying permissions on \$DATA_DIR..."
    chown -R sanvasify:sanvasify "\$DATA_DIR/"
    chmod 750 "\$DATA_DIR/"
    
    echo ">>> [REMOTE] Starting services..."
    systemctl daemon-reload
    systemctl start sanvasify caddy
    
    echo ">>> [REMOTE] Verification:"
    echo "Active database path configuration:"
    grep '^db_path' "\$CONFIG_FILE"
    
    echo "Service Status:"
    echo "  sanvasify: \$(systemctl is-active sanvasify)"
    echo "  caddy:     \$(systemctl is-active caddy)"
EOF

log_info "Successfully switched database on AWS instance to $TARGET_DB."
