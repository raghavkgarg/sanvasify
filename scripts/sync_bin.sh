#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

KEY_FILE="$PROJECT_ROOT/sn1.pem"

# Fixed IP Configuration

IPV4="13.234.173.198"
IPV6="2406:da1a:5e:0:6456:790e:6774:9561"
IP_TO_USE="$IPV6" # Set to $IPV4 or $IPV6 as needed

# User and Host Configuration
REMOTE_USER_HOST="ec2-user@$IP_TO_USE"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# SCP requires brackets for IPv6 literals to distinguish from the host/path separator.
SCP_DEST="$REMOTE_USER_HOST"
if [[ "$IP_TO_USE" == *:* ]]; then
    SCP_DEST="ec2-user@[$IP_TO_USE]"
fi

echo ">>> [LOCAL] 1. Navigating to project root..."
cd "$PROJECT_ROOT"

# Ensure Homebrew paths are initialized (common issue on macOS for /bin/bash scripts)
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null || true)"

echo ">>> [LOCAL] 2. Building for Linux ARM64..."
make build-linux-arm64

echo ">>> [LOCAL] 3. Uploading Binary to staging area..."
scp $SSH_OPTS -i "$KEY_FILE" "$PROJECT_ROOT/sanvasify" "$SCP_DEST:~/"

echo ">>> [REMOTE] 4-10. Executing Remote Deployment..."
ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" << EOF
    set -e # Exit immediately if a command fails on the remote server
    # 5. Set Ownership (Run before enabling services)
    echo "Setting initial ownership..."
    sudo chown -R sanvasify:sanvasify /opt/sanvasify

    # 6. Stop Services
    echo "Stopping services..."
    sudo systemctl stop sanvasify
    sudo systemctl stop caddy

    # 7. Back up and Replace Binary
    echo "Backing up and replacing binary..."
    if [ -f /opt/sanvasify/bin/sanvasify ]; then
        sudo mv /opt/sanvasify/bin/sanvasify /opt/sanvasify/bin/sanvasify.bak
    fi
    sudo mv ~/sanvasify /opt/sanvasify/bin/

    # 8. Fix Permissions (Critical)
    echo "Applying final permissions and ownership..."
    sudo chown -R sanvasify:sanvasify /opt/sanvasify
    # Allow the web server (Caddy) to traverse the directory while keeping data private
    sudo chmod 755 /opt/sanvasify
    sudo chmod -R 750 /opt/sanvasify/bin /opt/sanvasify/data
    sudo chmod +x /opt/sanvasify/bin/sanvasify

    # 9. Start Services
    echo "Restarting services..."
    sudo systemctl daemon-reload
    sudo systemctl start sanvasify
    sudo systemctl start caddy

    # 10. Verification
    echo "--- App Status ---"
    sudo systemctl status sanvasify --no-pager
    echo "--- Caddy Status ---"
    sudo systemctl status caddy --no-pager
EOF

echo ">>> Binary Workflow Finished Successfully."