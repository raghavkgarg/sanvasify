#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KEY_FILE="$PROJECT_ROOT/sn1.pem"
REMOTE_USER_HOST="ec2-user@13.234.173.198"

# Force IST for local date commands
export TZ='Asia/Kolkata'

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
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo -e "${GREEN}>>> Connecting to AWS to verify Sanvasify status on $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

ssh $SSH_OPTS $SSH_TTY -i "$KEY_FILE" "$REMOTE_USER_HOST" "TZ='Asia/Kolkata' GREEN='$GREEN' YELLOW='$YELLOW' RED='$RED' NC='$NC' bash -s" << 'EOF'
    # Colors for remote output
    # 0. System Health Overview
    echo -e "${YELLOW}--- 0. System Health Overview ---${NC}"
    echo -n "Uptime:       " && uptime -p
    echo -n "Load Average: " && cat /proc/loadavg | awk '{print $1, $2, $3}'
    echo "Memory Usage:"
    free -h | grep -E 'Mem:|Swap:'
    echo ""

    # 1. Disk Space Verification (Phase 4.1)
    echo -e "${YELLOW}--- 1. Disk Space Verification ---${NC}"
    DISK_USAGE=$(sudo df /opt/sanvasify/data --output=pcent | tail -1 | tr -dc '0-9')
    if [ -n "$DISK_USAGE" ] && [ "$DISK_USAGE" -lt 50 ]; then
        echo -e "Status: ${GREEN}DISK is Fine ($DISK_USAGE% used)${NC}"
    else
        echo -e "Status: ${RED}DISK Threshold passed or unreachable ($DISK_USAGE% used)${NC}"
    fi
    sudo df -h /opt/sanvasify/data | grep -v Filesystem
    echo ""

    # 2. Database File Verification (Phase 4.1)
    echo -e "${YELLOW}--- 2. Database File & Content Verification ---${NC}"
    DB_PATH="/opt/sanvasify/data/sanvasify.db"
    DB_LIMIT_MB=500
    if sudo [ -f "$DB_PATH" ]; then
        sudo ls -la "$DB_PATH"

        # Database Size Check
        DB_SIZE_MB=$(sudo du -m "$DB_PATH" | awk '{print $1}')
        if [ "$DB_SIZE_MB" -lt "$DB_LIMIT_MB" ]; then
            echo -e "DB Size:       ${GREEN}Fine ($DB_SIZE_MB MB)${NC}"
        else
            echo -e "DB Size:       ${RED}Threshold passed ($DB_SIZE_MB MB)${NC}"
        fi

        # Check record count if duckdb is installed
        DUCKDB_CMD=$(command -v duckdb || echo "/usr/local/bin/duckdb")
        if [ -x "$DUCKDB_CMD" ]; then
            # Snapshot approach: Copy DB to temp to bypass exclusive lock held by the running application
            TEMP_DB="/tmp/status_snapshot_$$.db"
            sudo cp "$DB_PATH" "$TEMP_DB"
            sudo chmod 644 "$TEMP_DB" # Reverted to 644 for better security

            # Check if table exists first (run duckdb with sudo to avoid permission issues)
            TABLE_CHECK=$(sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT name FROM information_schema.tables WHERE table_name='sif_schemes';" 2>&1)
            if [ -z "$TABLE_CHECK" ]; then
                echo -e "${RED}Error: Table 'sif_schemes' not found in database${NC}"
                echo "Available tables:"
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT table_name FROM information_schema.tables;" 2>&1
            else
                echo -e "Table Status:  ${GREEN}sif_schemes found${NC}"
                echo -n "Total Records: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT COUNT(*) FROM sif_schemes;" 2>/dev/null || echo "Error"
                echo -n "Latest Date:   "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SELECT MAX(date) FROM sif_schemes;" 2>/dev/null || echo "Error"
                echo -n "Current date in LINUX: $(date -d "today" '+%Y-%m-%d'): "
                echo -n "Current date in DuckDB: "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT current_date();" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "today" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "yesterday" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 1 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "2 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 2 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "3 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 3 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "4 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 4 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "5 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 5 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "6 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 6 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "7 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 7 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "8 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 8 DAY;" 2>/dev/null || echo "Error"
                echo -n "No of Schemes Loaded for $(date -d "9 days ago" '+%Y-%m-%d'): "
                sudo "$DUCKDB_CMD" "$TEMP_DB" -list -noheader -c "SET TimeZone='Asia/Kolkata'; SELECT COUNT(*) FROM sif_schemes WHERE date = CURRENT_DATE - INTERVAL 9 DAY;" 2>/dev/null || echo "Error"



            fi

            sudo rm -f "$TEMP_DB"
        else
            echo -e "${YELLOW}Note: 'duckdb' CLI not found, skipping deep data check.${NC}"
            echo "To enable: sudo wget -O /usr/local/bin/duckdb.zip https://github.com/duckdb/duckdb/releases/download/v1.1.3/duckdb_cli-linux-aarch64.zip && sudo unzip -o /usr/local/bin/duckdb.zip -d /usr/local/bin/ && sudo rm /usr/local/bin/duckdb.zip"
        fi
    else
        echo -e "${RED}Error: Database file not found at $DB_PATH${NC}"
    fi
    echo ""

    # 3. Service Status Verification (Phase 4.5)
    echo -e "${YELLOW}--- 3. Service Status Verification ---${NC}"
    SERVICES=("sanvasify" "caddy")
    for service in "${SERVICES[@]}"; do
        if systemctl is-active --quiet "$service"; then
            echo -e "$service: ${GREEN}ACTIVE${NC}"
        else
            echo -e "$service: ${RED}INACTIVE/FAILED${NC}"
            sudo systemctl status "$service" --no-pager -n 5
        fi
    done
    echo ""

    # 4. Port Listening Verification (Phase 4.3)
    echo -e "${YELLOW}--- 4. Port Listening Verification ---${NC}"
    # Checking for processes on 80 (HTTP), 443 (HTTPS), and 8080 (Internal App)
    sudo ss -tlnp | grep -E ':(80|443|8080)' || echo -e "${RED}Warning: No processes listening on ports 80, 443, or 8080${NC}"
    echo ""
    PORTS=(80 443 8080)
    LABELS=("80 (HTTP)          " "443 (HTTPS)        " "8080 (Internal App)")
    for i in "${!PORTS[@]}"; do
        PORT=${PORTS[$i]}
        LABEL=${LABELS[$i]}
        if sudo ss -tln | grep -q ":$PORT "; then
            echo -e "$LABEL: ${GREEN}Listening Fine${NC}"
        else
            echo -e "$LABEL: ${RED}NOT LISTENING${NC}"
        fi
    done
    echo ""

    curl -s http://localhost:8080/health | jq . || echo "ALERT: Health check failed"
    echo ""


    # 5. Local API Health Checks (Phase 4.4)
    echo -e "${YELLOW}--- 5. Local API Health Check ---${NC}"
    if curl -s --fail http://localhost:8080/api/schemes > /dev/null; then
        echo -e "Internal API (8080): ${GREEN}UP${NC}"
    else
        echo -e "Internal API (8080): ${RED}DOWN${NC}"
    fi

    # Note: This might fail if SSL is mandatory and Host headers aren't set correctly
    if curl -s --fail -I http://localhost/ > /dev/null; then
        echo -e "Public Web Gateway:  ${GREEN}UP${NC}"
    else
        echo -e "Public Web Gateway:  ${RED}NOT RESPONDING (Check Caddy status)${NC}"
    fi
    echo ""

    # 6. Configuration Verification (Phase 4.2)
    echo -e "${YELLOW}--- 6. Configuration Verification ---${NC}"
    CONFIG_FILE="/opt/sanvasify/config/Config.toml"
    if [ -f "$CONFIG_FILE" ]; then
        if sudo -u sanvasify cat "$CONFIG_FILE" > /dev/null 2>&1; then
            echo -e "Config File: ${GREEN}READABLE by sanvasify user${NC}"
            grep "db_path" "$CONFIG_FILE"
        else
            echo -e "Config File: ${RED}PERMISSION DENIED (Not readable by sanvasify user)${NC}"
        fi
    fi
    echo ""

    # 7. Caddy SSL Certificate Expiration
    echo -e "${YELLOW}--- 7. Caddy SSL Certificate Expiration ---${NC}"
    # On this instance, Caddy data is located in /caddy/certificates
    CERT_FILE=$(sudo find /caddy/certificates/ /var/lib/caddy/ -name "*.crt" -o -name "cert.pem" 2>/dev/null | head -n 1)

    if [ -z "$CERT_FILE" ]; then
        echo -e "${RED}Error: No Caddy SSL certificate found in expected location.${NC}"
        echo "Checked: /caddy/certificates/ and /var/lib/caddy/"
    else
        EXPIRATION_DATE_STR=$(sudo openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -z "$EXPIRATION_DATE_STR" ]; then
            echo -e "${RED}Error: Could not parse expiration date from $CERT_FILE.${NC}"
        else
            # Convert expiration date string to timestamp, then calculate days left
            EXPIRATION_TIMESTAMP=$(date -d "$EXPIRATION_DATE_STR" +%s)
            CURRENT_TIMESTAMP=$(date +%s)
            DAYS_LEFT=$(( (EXPIRATION_TIMESTAMP - CURRENT_TIMESTAMP) / (60*60*24) ))

            echo "Certificate: $CERT_FILE"
            echo "Expires On:  $EXPIRATION_DATE_STR"
            echo "Days Left:   $DAYS_LEFT"

            if [ "$DAYS_LEFT" -le 7 ]; then # Critical: less than 7 days
                echo -e "Status:      ${RED}CRITICAL: Certificate expires in $DAYS_LEFT days!${NC}"
            elif [ "$DAYS_LEFT" -le 30 ]; then # Warning: less than 30 days
                echo -e "Status:      ${RED}WARNING: Certificate expires in $DAYS_LEFT days.${NC}"
            else
                echo -e "Status:      ${GREEN}OK: Certificate expires in $DAYS_LEFT days.${NC}"
            fi
        fi
    fi
    echo ""

    # 8. Recent Application Logs
    echo -e "${YELLOW}--- 8. Recent Application Logs (Last 10 lines) ---${NC}"
    sudo journalctl -u sanvasify -n 10 --no-pager
EOF
echo -e "${GREEN}>>> Verification Complete at $(date '+%Y-%m-%d %H:%M:%S').${NC}"