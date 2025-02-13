# Bookkeeper SQLite

A simple bookkeeping application with SQLite database, FastAPI backend, and vanilla JavaScript frontend.

## Local Development

### Prerequisites
- Docker Desktop
- Git

### Quick Start
1. Clone the repository:
```bash
git clone https://github.com/yourusername/bookkeeper-sqlite.git
cd bookkeeper-sqlite
```

2. Start the application:
```bash
docker-compose up
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

The local setup uses volume mounting, so any changes to the code or database will be immediately reflected.

## Production Deployment

The application is deployed on Railway.app using GitHub Actions for continuous deployment.

### Deployment Setup

1. Create a Railway account at https://railway.app/

2. Get your Railway token:
   - Click your profile picture → Developer Settings
   - Create new token
   - Copy the token (starts with `rail_`)

3. Add secrets to GitHub:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add two secrets:
     - `RAILWAY_TOKEN`: Your Railway token
     - `RAILWAY_SERVICE_NAME`: Your service name (usually your repo name)

4. Deploy:
   - Push to the `main` branch
   - GitHub Actions will automatically deploy to Railway
   - The deployment includes your local database

### Architecture

- **Single Container**: Both frontend and backend run in one container
- **Caddy Server**: Handles routing and serving files
  - Frontend served at `/`
  - API endpoints available at `/api/*`
  - Automatic handling of SPA routes
- **Database**: Currently included in the build (will be moved to Railway volume later)

### Database Management

The current setup includes the database in the deployment:
1. Make changes to your local database
2. Commit and push to main
3. The updated database will be included in the next deployment

## Future Improvements

- [ ] Move to Railway volume for database persistence
- [ ] Add backup/restore functionality
- [ ] Implement user authentication
- [ ] Add multi-user support

## Development Notes

### File Structure
```
.
├── backend/           # FastAPI backend
├── frontend/          # Vanilla JS frontend
├── data/             # Database directory
├── migrations/       # Alembic migrations
├── Dockerfile        # Production/development container
└── docker-compose.yml # Local development setup
```

### Environment Variables
- `DATABASE_URL`: SQLite database location
- `PORT`: Application port (default: 8000)
- `PYTHONPATH`: Python path configuration

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally using docker-compose
4. Submit a pull request

## License

[Add your license here]


A

