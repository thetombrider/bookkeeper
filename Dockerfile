FROM python:3.11-slim

WORKDIR /app

# Install SQLite
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory
RUN mkdir -p /data

# Copy application files
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY alembic.ini /app/
COPY migrations/ /app/migrations/
COPY data/bookkeeper.db /data/bookkeeper.db

# Set environment
ENV DATABASE_URL="sqlite:////data/bookkeeper.db"
ENV PORT=8000
ENV PYTHONPATH=/app

# Create startup script
RUN echo '#!/bin/sh\n\
cd /app\n\
\n\
# Start the backend in the background\n\
cd /app/backend\n\
python -m uvicorn api:app --host 0.0.0.0 --port 8000 &\n\
\n\
# Start the frontend HTTP server\n\
cd /app/frontend\n\
exec python -m http.server 3000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 8000

# Run the application
CMD ["/app/start.sh"] 