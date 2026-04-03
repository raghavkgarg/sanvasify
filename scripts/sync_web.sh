#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

KEY_FILE="$PROJECT_ROOT/sn1.pem"
REMOTE_USER_HOST="ec2-user@13.234.173.198"
LOCAL_WEB_DIR="$PROJECT_ROOT/web"
REMOTE_WEB_DIR="/opt/sanvasify/web"

echo ">>> [LOCAL] 0. Cleaning up remote staging area..."
ssh -i "$KEY_FILE" "$REMOTE_USER_HOST" "rm -rf ~/web"

echo ">>> [LOCAL] 1. Uploading the entire 'web' directory..."
scp -i "$KEY_FILE" -r "$LOCAL_WEB_DIR" "$REMOTE_USER_HOST:~/"

echo ">>> [REMOTE] 2-6. Executing Deployment Steps..."
ssh -i "$KEY_FILE" "$REMOTE_USER_HOST" << EOF
    set -e # Exit immediately if a command fails on the remote server
    # 3. Stop Services
    echo "Stopping services..."
    sudo systemctl stop sanvasify
    sudo systemctl stop caddy

    # 4. Move Web (Cleanup stale files first to match staging)
    if [ -d ~/web ]; then
        echo "Moving web artifacts to $REMOTE_WEB_DIR..."
        # Remove the destination entirely to ensure a clean slate
        sudo rm -rf "$REMOTE_WEB_DIR"
        sudo mv ~/web "$REMOTE_WEB_DIR"
    fi

    # 5. Verify Web has the right access
    echo "Setting ownership and permissions..."
    # Ensure the parent directory is traversable by the web server (Caddy)
    sudo chmod 755 /opt/sanvasify
    sudo chown -R sanvasify:sanvasify $REMOTE_WEB_DIR
    sudo chmod -R 755 $REMOTE_WEB_DIR

    # 6. Start Services
    echo "Starting services..."
    sudo systemctl restart sanvasify
    sudo systemctl restart caddy

    echo "--- Verification ---"
    echo "Checking core artifacts in $REMOTE_WEB_DIR:"
    # We now check inside the 'static' subdirectory which is preserved
    if [ -f "$REMOTE_WEB_DIR/static/index.html" ]; then
        ls -lh "$REMOTE_WEB_DIR/static/index.html"
        [ -f "$REMOTE_WEB_DIR/static/css/style.css" ] && ls -lh "$REMOTE_WEB_DIR/static/css/style.css"
    else
        echo "index.html not found in expected location: $REMOTE_WEB_DIR/static/"
        echo "Actual directory structure of $REMOTE_WEB_DIR (if it exists):"
        sudo ls -R "$REMOTE_WEB_DIR" | head -n 20
    fi
    echo "Web deployment complete. Sanvasify status: \$(sudo systemctl is-active sanvasify)"
EOF

echo ">>> Web Workflow Finished Successfully."