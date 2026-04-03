#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration - Update these if your environment changes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

KEY_FILE="$PROJECT_ROOT/sn1.pem"
REMOTE_USER_HOST="ec2-user@13.234.173.198"
LOCAL_DB="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"
REMOTE_DATA_DIR="/opt/sanvasify/data"

cd "$PROJECT_ROOT"

echo ">>> [LOCAL] 1. Running Fetcher..."
go build -o dist/fetch ./cmd/fetch

# Run fetcher and handle the "already up to date" signal (exit code 2)
set +e
./dist/fetch
FETCH_STATUS=$?
set -e

if [ $FETCH_STATUS -eq 2 ]; then
    echo ">>> [LOCAL] Data is already up to date. Skipping remaining steps."
    exit 0
elif [ $FETCH_STATUS -ne 0 ]; then
    exit $FETCH_STATUS
fi

echo ">>> [LOCAL] 2. Running Loader..."
go build -o dist/load ./cmd/load
./dist/load

echo ">>> [LOCAL] 3. Uploading Database to staging area on AWS..."
scp -i "$KEY_FILE" "$LOCAL_DB" "$REMOTE_USER_HOST:~/"

echo ">>> [REMOTE] Executing Deployment Steps (4-9)..."
ssh -i "$KEY_FILE" "$REMOTE_USER_HOST" << EOF
    set -e # Exit immediately if a command fails on the remote server
    # 8. Stop Services (Stopping first ensures the database file isn't in use)
    echo "Stopping Sanvasify and Caddy services..."
    sudo systemctl stop sanvasify
    sudo systemctl stop caddy

    # 5 & 6. Move Database & Handle Migration (Cleanup WAL)
    if [ -f ~/sanvasify.db ]; then
        echo "Moving new database to $REMOTE_DATA_DIR..."
        sudo mv ~/sanvasify.db $REMOTE_DATA_DIR/
        
        # Remove WAL file to prevent corruption on swap
        if [ -f $REMOTE_DATA_DIR/sanvasify.db.wal ]; then
            sudo rm -f $REMOTE_DATA_DIR/sanvasify.db.wal
        fi
    fi

    # 7. Verify database permissions
    echo "Applying ownership and permissions..."
    sudo chown -R sanvasify:sanvasify $REMOTE_DATA_DIR/
    sudo chmod 750 $REMOTE_DATA_DIR/

    # 9. Start Services
    echo "Reloading systemd and restarting services..."
    sudo systemctl daemon-reload
    sudo systemctl start sanvasify
    sudo systemctl start caddy
    
    echo "Deployment complete. Sanvasify status: \$(sudo systemctl is-active sanvasify)"
EOF

echo ">>> Database Workflow Finished Successfully."