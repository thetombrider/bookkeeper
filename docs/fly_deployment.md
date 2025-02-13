# Fly.io Deployment Plan

## Overview
This document outlines the steps to deploy our bookkeeping application on Fly.io. We'll use:
- Fly.io for both frontend and backend hosting
- SQLite with Litestream for database (built into Fly.io)
- S3-compatible storage for database backups
- GitHub Actions for CI/CD

## 1. Prerequisites

1. Install Fly CLI:
```bash
# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login to Fly.io
fly auth login
```

2. Install Docker Desktop (for local testing):
```bash
winget install Docker.DockerDesktop
```

## 2. Project Structure Updates

1. Create `fly.toml` for backend:
```toml
app = "bookkeeper-backend"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8000"
  ENVIRONMENT = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[mounts]
  source="bookkeeper_data"
  destination="/data"

[[services]]
  protocol = "tcp"
  internal_port = 8000
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
  
  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "1s"
```

2. Create `fly.toml` for frontend:
```toml
app = "bookkeeper-frontend"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

3. Update `Dockerfile` for backend:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install SQLite and curl
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy application files
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend ./backend
COPY alembic.ini .
COPY migrations ./migrations

# Create data directory for SQLite
RUN mkdir -p /data
ENV DATABASE_URL="sqlite:////data/bookkeeper.db"

EXPOSE 8000
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

4. Create `Dockerfile` for frontend:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY frontend ./frontend

RUN npm install -g serve

EXPOSE 3000
CMD ["serve", "-s", "frontend", "-l", "3000"]
```

5. Create `.github/workflows/fly.yml`:
```yaml
name: Deploy to Fly.io
on:
  push:
    branches: [ main ]
  workflow_dispatch:  # Allow manual triggers

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          
      - name: Run tests
        run: |
          pytest

  deploy:
    name: Deploy apps
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: superfly/flyctl-actions/setup-flyctl@master
        with:
          version: 0.1.62
      
      - name: Deploy Backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          cd backend
          flyctl deploy --remote-only
      
      - name: Deploy Frontend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          cd frontend
          flyctl deploy --remote-only
      
      - name: Run Database Migrations
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          flyctl ssh console -a bookkeeper-backend -- "cd /app && alembic upgrade head"
      
      - name: Verify Deployment
        run: |
          # Wait for services to be ready
          sleep 30
          
          # Check backend health
          curl -f https://bookkeeper-backend.fly.dev/health || exit 1
          
          # Check frontend is accessible
          curl -f https://bookkeeper-frontend.fly.dev || exit 1
      
      - name: Notify on Failure
        if: failure()
        run: |
          echo "Deployment failed! Check the logs for details."
          # Add your notification logic here (e.g., Discord, Slack, email)

  cleanup:
    name: Cleanup Old Deployments
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: superfly/flyctl-actions/setup-flyctl@master
        with:
          version: 0.1.62
      
      - name: Remove old deployments
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          flyctl releases prune -a bookkeeper-backend --keep 5
          flyctl releases prune -a bookkeeper-frontend --keep 5
```

The improved workflow adds:
1. Automated testing before deployment
2. Deployment verification steps
3. Database migration automation
4. Cleanup of old deployments
5. Failure notifications
6. Manual trigger option
7. Keeps only last 5 releases

You'll need to add these secrets to your GitHub repository:
```
FLY_API_TOKEN: Your Fly.io API token
```

And add a health check endpoint to your backend (`api.py`):
```python
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

## 3. Database Configuration

1. Create volume for SQLite:
```bash
fly volumes create bookkeeper_data --size 1 --region ams
```

2. Enable Litestream backup to S3 (optional):
```bash
# Set S3 credentials
fly secrets set \
  AWS_ACCESS_KEY_ID=<access-key> \
  AWS_SECRET_ACCESS_KEY=<secret-key> \
  AWS_DEFAULT_REGION=eu-central-1 \
  LITESTREAM_BUCKET=my-backup-bucket
```

## 4. Deployment Steps

1. Create the applications:
```bash
# Create backend app
fly apps create bookkeeper-backend

# Create frontend app
fly apps create bookkeeper-frontend
```

2. Deploy the applications:
```bash
# Deploy backend
cd backend
fly deploy

# Deploy frontend
cd frontend
fly deploy
```

3. Configure secrets:
```bash
# Backend secrets
fly secrets set \
  --app bookkeeper-backend \
  JWT_SECRET=<your-jwt-secret> \
  ENVIRONMENT=production

# Frontend secrets
fly secrets set \
  --app bookkeeper-frontend \
  API_URL=https://bookkeeper-backend.fly.dev
```

## 5. Database Management

1. Connect to SQLite console:
```bash
fly ssh console -a bookkeeper-backend
sqlite3 /data/bookkeeper.db
```

2. Run migrations:
```bash
fly ssh console -a bookkeeper-backend
cd /app
alembic upgrade head
```

3. Backup database manually:
```bash
fly ssh console -a bookkeeper-backend
sqlite3 /data/bookkeeper.db ".backup '/tmp/backup.db'"
```

## 6. Monitoring and Logs

1. View application logs:
```bash
# Backend logs
fly logs -a bookkeeper-backend

# Frontend logs
fly logs -a bookkeeper-frontend
```

2. Monitor application metrics:
```bash
fly metrics -a bookkeeper-backend
```

## 7. Cost Estimation (Monthly)

- Shared-CPU-1x VM (2): $5/month each
- 1GB Volume: $0.15/GB/month
- Total Estimated Cost: ~$10.15/month

## 8. Scaling Options

1. Vertical Scaling:
```bash
# Upgrade to higher performance VM
fly scale vm shared-cpu-2x
```

2. Horizontal Scaling:
```bash
# Add more instances
fly scale count 2
```

3. Geographic Scaling:
```bash
# Add new region
fly regions add fra
```

## 9. Deployment Checklist

### Initial Setup
- [ ] Install Fly CLI
- [ ] Create Fly.io account and authenticate
- [ ] Create GitHub repository secrets
- [ ] Configure environment variables

### Deployment
- [ ] Create Fly.io apps
- [ ] Create volume for SQLite
- [ ] Deploy backend application
- [ ] Deploy frontend application
- [ ] Run database migrations
- [ ] Configure backup storage (if using S3)

### Post-Deployment
- [ ] Verify frontend can access backend
- [ ] Test all API endpoints
- [ ] Check database persistence
- [ ] Monitor application logs
- [ ] Test backup/restore procedures

## 10. Useful Commands

```bash
# Scale to different VM size
fly scale vm shared-cpu-2x -a bookkeeper-backend

# Add more regions
fly regions add fra -a bookkeeper-backend

# Monitor app status
fly status -a bookkeeper-backend

# View app information
fly info -a bookkeeper-backend

# SSH into the VM
fly ssh console -a bookkeeper-backend

# View deployment status
fly status -a bookkeeper-backend
``` 