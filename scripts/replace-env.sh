#!/bin/sh

# Replace environment variables in config.js
envsubst < /app/frontend/config.js.template > /app/frontend/config.js

# Start the application
exec "$@" 