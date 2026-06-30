#!/bin/bash

# It uses rsync to ensure only changed files are transferred.

set -e

# Define Source and Destination paths
# Note: Destination uses quotes to handle the space in "Mobile Documents"
SOURCE="/Users/raghavgarg/Projects/myGo/sanvasify/web/v1"
DESTINATION="/Users/raghavgarg/Projects/myGo/sanvasify/web/static"

echo ">>> Syncing V1 to Static..."

echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
echo -e "${GREEN}>>> Syncing V1 to Static... $(date '+%Y-%m-%d %H:%M:%S') ...${NC}\n"

# Create destination directory if it doesn't exist
mkdir -p "$DESTINATION"

# Perform the copy/sync
# -a: Archive mode (preserves permissions, symlinks, and timestamps)
# -v: Verbose output so you can see what is being copied
rsync -av "$SOURCE/" "$DESTINATION/"

echo -e "${GREEN}>>> Sync complete. Files are now in Static: $DESTINATION on $(date '+%Y-%m-%d %H:%M:%S') "
echo -e "${GREEN}>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>*>.${NC}"
