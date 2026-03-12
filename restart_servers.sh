#!/bin/bash

# restart_servers.sh
# Forces all server processes to close, then restarts them from scratch.

echo "Stopping existing servers..."
# Kill processes bound to Gateway and Frontend ports
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo "Waiting for ports to clear..."
sleep 2

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Cleaning and Seeding Database..."
cd "$SCRIPT_DIR/services/bifrost"
go run cmd/clean/main.go
go run cmd/seed/main.go

echo "Starting Bifrost Gateway Server (Backend)..."
cd "$SCRIPT_DIR/services/bifrost"
nohup go run cmd/gateway/main.go > /tmp/bifrost.log 2>&1 &
BIFROST_PID=$!
echo "Bifrost (Backend) started with PID: $BIFROST_PID"

echo "Starting Vite Dev Server (Frontend)..."
cd "$SCRIPT_DIR/ui"
nohup npm run dev > /tmp/vite.log 2>&1 &
VITE_PID=$!
echo "Vite (Frontend) started with PID: $VITE_PID"

echo "Waiting for servers to initialize..."
sleep 5

echo "Servers restarted successfully."
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:5173"
