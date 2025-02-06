#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Starting backend server..."

# Start backend server
python -m uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
MAX_RETRIES=30
COUNT=0
while ! curl -s http://localhost:8000/docs > /dev/null && [ $COUNT -lt $MAX_RETRIES ]; do
    sleep 1
    ((COUNT++))
    echo "Waiting for backend to start... ($COUNT/$MAX_RETRIES)"
done

if [ $COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Backend failed to start within $MAX_RETRIES seconds${NC}"
    kill $BACKEND_PID
    exit 1
fi

echo -e "${GREEN}Backend is running!${NC}"

# Start frontend server
echo "Starting frontend server..."
cd frontend
python -m http.server 3000 &
FRONTEND_PID=$!

# Handle script interruption
trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT SIGTERM

# Keep script running
wait 