#!/bin/bash

# Awake till this script finishes (prevents sleep on macOS during long operations)
caffeinate -i -w $$ & 

# Exit immediately if a command exits with a non-zero status.
set -e

# Configuration - Update these if your environment changes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Force IST for local date commands
export TZ='Asia/Kolkata'

mkdir -p "$PROJECT_ROOT/scriptslog"
KEY_FILE="$PROJECT_ROOT/sn1.pem"
REMOTE_USER_HOST="ec2-user@13.234.173.198"
LOCAL_DB="/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"
REMOTE_DATA_DIR="/opt/sanvasify/data"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Colors for output
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'  
    YELLOW='\033[0;33m'
    NC='\033[0m'
    SSH_TTY="-t"
else
    GREEN=''
    RED=''
    YELLOW=''
    NC=''
    SSH_TTY=""
fi


echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>..${NC}\n"
echo -e "${GREEN}>>> Starting Database Sync Workflow on $(date '+%Y-%m-%d %H:%M:%S') .${NC}"


# Pre-flight check: Verify connectivity to AWS before starting local work
echo ">>> [PRE-FLIGHT] Checking SSH connectivity to AWS..."
if ! ssh $SSH_OPTS -i "$KEY_FILE" -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE_USER_HOST" exit; then
    CURRENT_IP=$(curl -s https://checkip.amazonaws.com || echo "unknown")
    echo -e "\n${RED}Error: Connection to AWS failed.${NC}"
    echo -e "${YELLOW}Ensure your current IP (${CURRENT_IP}) is allowed in the AWS Security Group for port 22.${NC}\n"
    exit 1
fi

cd "$PROJECT_ROOT"

echo -e "${GREEN}>>> [LOCAL] 1. Running Fetcher... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

#go build -o dist/fetch ./cmd/fetch

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

echo -e "${GREEN}>>> [LOCAL] 2. Running Loader... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
go build -o dist/load ./cmd/load
./dist/load

echo -e "${GREEN}>>> [LOCAL] 3. Uploading Database to staging area on AWS... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
scp $SSH_OPTS -i "$KEY_FILE" "$LOCAL_DB" "$REMOTE_USER_HOST:~/"

echo -e "${GREEN}>>> [REMOTE] Executing Deployment Steps (4-9)... ${NC}\n"
ssh $SSH_OPTS $SSH_TTY -i "$KEY_FILE" "$REMOTE_USER_HOST" "TZ='Asia/Kolkata' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' GREEN='$GREEN' YELLOW='$YELLOW' RED='$RED' NC='$NC' bash -s" << 'EOF'
    # Colors for remote output
    set -e # Exit immediately if a command fails on the remote server
    # 4. Stop Services (Stopping first ensures the database file isn't in use)
    echo "Stopping Sanvasify and Caddy services..."
    echo -e "${GREEN}>>> [REMOTE] 4. Stopping Sanvasify and Caddy services...... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

    sudo systemctl stop sanvasify
    sudo systemctl stop caddy

    # 5 & 6. Move Database & Handle Migration (Cleanup WAL)
    
    if [ -z "$REMOTE_DATA_DIR" ] || [ "$REMOTE_DATA_DIR" == "/" ] || [ "$REMOTE_DATA_DIR" == "/home" ]; then
        echo -e "${RED}Error: REMOTE_DATA_DIR is empty or invalid ($REMOTE_DATA_DIR). Aborting to protect system integrity.${NC}"
        exit 1
    fi

    if [ -z "$REMOTE_DATA_DIR" ]; then
        echo -e "${RED}Error: REMOTE_DATA_DIR is empty. Aborting to prevent accidental root operation.${NC}"
        exit 1
    fi

    if [ -f ~/sanvasify.db ]; then
        echo -e "${GREEN}>>> [REMOTE] 5 & 6. Moving new database to $REMOTE_DATA_DIR... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
        sudo mv ~/sanvasify.db $REMOTE_DATA_DIR/
     
        # Remove WAL file to prevent corruption on swap
        if [ -f $REMOTE_DATA_DIR/sanvasify.db.wal ]; then
            sudo rm -f $REMOTE_DATA_DIR/sanvasify.db.wal
        fi
    fi

    # 7. Verify database permissions (critical for security and functionality)
    echo -e "${GREEN}>>> [REMOTE] 7. Applying ownership and permissions... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
    sudo chown -R sanvasify:sanvasify $REMOTE_DATA_DIR/
    sudo chmod 750 $REMOTE_DATA_DIR/

    # 9. Start Services
    echo -e "${GREEN}>>> [REMOTE] 9. Reloading systemd and restarting services... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
    sudo systemctl daemon-reload
    sudo systemctl start sanvasify
    sudo systemctl start caddy
    
    echo "Deployment complete. Sanvasify status: $(sudo systemctl is-active sanvasify)"
EOF
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
echo -e ">>> Database Workflow Finished Successfully.. on $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}\n"
