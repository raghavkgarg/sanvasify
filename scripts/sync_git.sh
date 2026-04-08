#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Determine the project root relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Capture the commit message from the first argument.
# If no argument is provided, it defaults to "Updated HTML Pages".
COMMIT_MSG="${1:-"Updated HTML Pages"}"

# 2. Stash local changes
echo "Stashing changes..."
STASH_RESULT=$(git stash)

# 3. Pull latest changes with rebase
echo "Rebasing from origin main..."
git pull --rebase origin main

# 4. Pop stash only if something was stashed
if [[ "$STASH_RESULT" != "No local changes to save" ]]; then
    echo "Popping stash..."
    git stash pop
fi

# 5. Add, commit, and push
git add .
git commit -m "$COMMIT_MSG"
git push origin main
