#!/bin/bash

LABEL="com.sanvasify"
PLIST="$(pwd)/com.sanvasify.plist"

case "${1:-help}" in
    start)
        # Kill anything already on port 8080
        STRAY=$(lsof -ti :8080 2>/dev/null)
        if [ -n "$STRAY" ]; then
            echo "Killing existing process on port 8080 (PID: $STRAY)"
            echo "$STRAY" | xargs kill 2>/dev/null
            sleep 1
        fi
        echo "Starting sanvasify..."
        launchctl bootstrap gui/$(id -u) "$PLIST" 2>/dev/null || \
        launchctl kickstart -k gui/$(id -u)/$LABEL
        sleep 1
        $0 status
        ;;

    stop)
        echo "Stopping sanvasify..."
        launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null && \
            echo "Stopped" || echo "Service not running"
        # Kill any stray processes
        PIDS=$(pgrep -f "dist/sanvasify" 2>/dev/null)
        if [ -n "$PIDS" ]; then
            echo "Killing stray processes: $PIDS"
            echo "$PIDS" | xargs kill 2>/dev/null
            sleep 1
        fi
        # Kill anything on port 8080
        lsof -ti :8080 | xargs kill 2>/dev/null
        ;;

    restart)
        $0 stop
        sleep 1
        $0 start
        ;;

    status)
        if launchctl print gui/$(id -u)/$LABEL 2>/dev/null | grep -q "state = running"; then
            echo "Running"
            launchctl print gui/$(id -u)/$LABEL | grep "pid ="
        else
            echo "Not running"
        fi
        ;;

    logs)
        echo "=== Output ==="
        tail -30 /tmp/sanvasify.log 2>/dev/null || echo "No logs"
        echo ""
        echo "=== Errors ==="
        tail -30 /tmp/sanvasify.err.log 2>/dev/null || echo "No errors"
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
