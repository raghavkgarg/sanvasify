#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

KEY_FILE="$PROJECT_ROOT/sn1.pem"

# Fixed IP Configuration
IPV4="13.234.173.198"
IPV6="2406:da1a:5e:0:7e64:c4a0:6ed6:9c12"
IP_TO_USE="$IPV6" # Set to $IPV4 or $IPV6 as needed

REMOTE_USER_HOST="ec2-user@$IP_TO_USE"
LOCAL_WEB_DIR="$PROJECT_ROOT/web"
REMOTE_WEB_DIR="/opt/sanvasify/web"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# SCP requires brackets for IPv6 literals to distinguish from the host/path separator.
# This prevents the 'No route to host' error where 2406 was interpreted as 0.0.9.102.
SCP_DEST="$REMOTE_USER_HOST"
if [[ "$IP_TO_USE" == *:* ]]; then
    SCP_DEST="ec2-user@[$IP_TO_USE]"
fi

echo ">>> [LOCAL] Checking for JS/CSS changes requiring cache-busting..."
STATIC_ASSETS=(
    "static/js/app.js" 
    "static/js/trends.js" 
    "static/css/style.css"
    "v1/js/app.js"
    "v1/css/style.css"
)
NEEDS_CACHE_BUST=false

for f in "${STATIC_ASSETS[@]}"; do
    LOCAL_PATH="$LOCAL_WEB_DIR/$f"
    REMOTE_PATH="$REMOTE_WEB_DIR/$f"
    
    if [ -f "$LOCAL_PATH" ]; then
        # Compare local MD5 hash with remote hash
        LOCAL_HASH=$(openssl dgst -md5 "$LOCAL_PATH" | awk '{print $NF}')
        REMOTE_HASH=$(ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "if [ -f $REMOTE_PATH ]; then openssl dgst -md5 $REMOTE_PATH | awk '{print \$NF}'; else echo 'none'; fi" 2>/dev/null || echo "none")
        
        if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
            echo "(!) Change detected in $f"
            NEEDS_CACHE_BUST=true
        fi
    fi
done

if [ "$NEEDS_CACHE_BUST" = true ]; then
    echo -e "\n\033[1;33mWARNING: One or more static assets (JS/CSS) have changed since the last deployment.\033[0m"
    echo -e "\033[1;33mEnsure you have updated the version parameter (e.g., ?v=1.0.x) in your HTML files.\033[0m\n"
    read -p "Continue with deployment? (y/n): " confirm
    [[ "$confirm" == [yY] ]] || exit 1
fi

if [ "$NEEDS_CACHE_BUST" = false ]; then
    echo -e "\n\033[1;33mINFO: No changes detected in static assets since the last deployment.\033[0m"
fi   

echo ">>> [LOCAL] 0. Cleaning up remote staging area..."
ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" "rm -rf ~/web"

echo ">>> [LOCAL] 1. Uploading the entire 'web' directory..."
scp $SSH_OPTS -i "$KEY_FILE" -r "$LOCAL_WEB_DIR" "$SCP_DEST:~/"

echo ">>> [REMOTE] 2-6. Executing Deployment Steps..."
ssh $SSH_OPTS -i "$KEY_FILE" "$REMOTE_USER_HOST" << EOF
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
        [ -f "$REMOTE_WEB_DIR/v1/index.html" ] && ls -lh "$REMOTE_WEB_DIR/v1/index.html"
    else
        echo "index.html not found in expected location: $REMOTE_WEB_DIR/static/"
        echo "Actual directory structure of $REMOTE_WEB_DIR (if it exists):"
        sudo ls -R "$REMOTE_WEB_DIR" | head -n 20
    fi
    echo "Web deployment complete. Sanvasify status: \$(sudo systemctl is-active sanvasify)"
EOF

echo ">>> Web Workflow Finished Successfully."