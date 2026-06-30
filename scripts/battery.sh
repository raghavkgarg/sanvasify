#!/bin/bash
echo "$(date): Battery check started."
BATT_INFO=$(pmset -g batt)
if [[ "$BATT_INFO" != *"Battery Power"* ]]; then
    echo "$(date): Connected to AC power. No action needed."
    exit 0
fi
BATT_PCT=$(echo "$BATT_INFO" | grep -o "[0-9]\{1,3\}%" | tr -d '%')
RECIPIENT="raghavk.garg@icloud.com" # Replace with your Apple ID or Phone Number
MSG="Sanvasify Mac Alert: Battery is at ${BATT_PCT}%. Please connect to power."

echo "$(date): Battery is at ${BATT_PCT}%"
if [ "$BATT_PCT" -lt 30 ]; then
    osascript -e "display notification \"$MSG\" with title \"Mac Battery Alert\""
    osascript -e "tell application \"Messages\" to send \"$MSG\" to buddy \"$RECIPIENT\"" &>/dev/null || true
    [ "$BATT_PCT" -lt 20 ] && echo "Critical Battery" && exit 1
fi