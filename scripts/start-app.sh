#!/bin/bash
# Start the FastAPI application

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}')
fi

cd /opt/app
uvicorn backend.app:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --reload