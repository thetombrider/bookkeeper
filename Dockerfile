FROM python:3.11-slim

WORKDIR /app

# Install SQLite and Caddy
RUN apt-get update && apt-get install -y \
    sqlite3 \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https \
    curl \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y caddy \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory
RUN mkdir -p /data

# Copy application files
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Copy database file
# TODO: Later replace this with Railway volume for production
COPY data/bookkeeper.db /data/bookkeeper.db

# Set environment
# Set environment variables from .env file
COPY .env /app/.env
RUN export $(cat /app/.env | xargs)

ENV DATABASE_URL=$DATABASE_URL
ENV PORT=$PORT
ENV PYTHONPATH=$PYTHONPATH
ENV BASIC_AUTH_USERNAME=$BASIC_AUTH_USERNAME
ENV BASIC_AUTH_PASSWORD=$BASIC_AUTH_PASSWORD

# Configure Caddy
RUN echo $'\
:3000 {\n\
    encode gzip\n\
    \n\
    # Global basic authentication\n\
    basicauth /* {\n\
        {$BASIC_AUTH_USERNAME} {$BASIC_AUTH_PASSWORD}\n\
    }\n\
    \n\
    # Handle API requests\n\
    handle /api/* {\n\
        uri strip_prefix /api\n\
        reverse_proxy localhost:8000\n\
    }\n\
    \n\
    # Handle static files\n\
    handle {\n\
        root * /app/frontend\n\
        try_files {path} {path}.html /index.html\n\
        file_server\n\
    }\n\
}' > /etc/caddy/Caddyfile

# Create startup script
RUN echo '#!/bin/sh
cd /app

# Start the backend in the background
cd /app/backend
python -m uvicorn api:app --host 0.0.0.0 --port 8000 &

# Start Caddy in the foreground
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
' > /app/start.sh && chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Run the application
CMD ["/app/start.sh"]