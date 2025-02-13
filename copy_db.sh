#!/bin/bash

# Get the app name
APP_NAME="bookkeeper-sqlite"

# Check if the database file exists
if [ ! -f "data/bookkeeper.db" ]; then
    echo "Error: data/bookkeeper.db not found"
    exit 1
fi

# Copy the database to the Fly.io volume
echo "Copying database to Fly.io volume..."
fly ssh sftp shell -a $APP_NAME << EOF
cd /data
put data/bookkeeper.db bookkeeper.db
chmod 644 bookkeeper.db
exit
EOF

echo "Database copy complete!" 