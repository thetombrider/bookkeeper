# Scheduler Implementation Plan

## Overview
Implement a robust scheduling system to handle periodic tasks, particularly for the GoCardless integration, to manage rate limits and ensure smooth data synchronization.

## Requirements

### Core Features
1. Scheduled sync operations for bank transactions
2. Rate limit management
3. Error handling and retry mechanisms
4. Status tracking and reporting
5. Configurable scheduling intervals

### Technical Components

#### 1. Database Schema Updates
```sql
-- New tables needed:
CREATE TABLE scheduled_tasks (
    id VARCHAR(36) PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,  -- e.g., 'sync_transactions', 'refresh_token'
    source_id VARCHAR(36) NOT NULL,   -- reference to import_sources
    schedule_type VARCHAR(20) NOT NULL, -- 'daily', 'hourly', etc.
    last_run TIMESTAMP,
    next_run TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,      -- 'pending', 'running', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_logs (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    execution_start TIMESTAMP NOT NULL,
    execution_end TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Scheduler Service
- Implement a background service using APScheduler
- Support for different schedule types:
  - Fixed interval (daily, hourly)
  - Cron-style scheduling
  - Rate-limit aware scheduling

#### 3. Task Types
1. **Transaction Sync**
   - Sync bank transactions with rate limit awareness
   - Handle per-account rate limits
   - Implement exponential backoff for retries

2. **Connection Health Check**
   - Verify bank connection status
   - Refresh tokens if needed
   - Mark connections as disconnected if authorization expired

3. **Cleanup Tasks**
   - Remove old task logs
   - Clean up failed tasks
   - Archive old transactions

### Implementation Phases

#### Phase 1: Basic Infrastructure
1. Set up database tables
2. Implement basic scheduler service
3. Create basic task management system

#### Phase 2: Core Task Implementation
1. Implement transaction sync task
2. Add rate limit management
3. Implement retry mechanism
4. Add basic error handling

#### Phase 3: Advanced Features
1. Add connection health monitoring
2. Implement cleanup tasks
3. Add detailed logging
4. Create admin interface

#### Phase 4: Monitoring and Management
1. Add task status dashboard
2. Implement notification system
3. Add manual task triggering
4. Create task history view

## API Endpoints

### Task Management
```python
# New endpoints to add:
@app.post("/scheduled-tasks/", response_model=ScheduledTaskResponse)
async def create_scheduled_task(task_data: ScheduledTaskCreate)

@app.get("/scheduled-tasks/", response_model=List[ScheduledTaskResponse])
async def list_scheduled_tasks(status: Optional[str] = None)

@app.get("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(task_id: str)

@app.put("/scheduled-tasks/{task_id}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(task_id: str, task_data: ScheduledTaskUpdate)

@app.delete("/scheduled-tasks/{task_id}")
async def delete_scheduled_task(task_id: str)

@app.post("/scheduled-tasks/{task_id}/run")
async def trigger_task(task_id: str)
```

## Frontend Updates

### New Components
1. Task Management Page
   - List of scheduled tasks
   - Task creation/editing
   - Task history view
   - Manual task triggering

2. Dashboard Widgets
   - Next scheduled runs
   - Recent task status
   - Error notifications

### Integration Settings
- Add scheduling options to integration setup
- Configure sync frequency
- Set retry policies

## Dependencies
```python
# Add to requirements.txt:
apscheduler==3.10.1
redis==5.0.1  # For distributed task locking
```

## Configuration
```python
# Add to config.py:
SCHEDULER_CONFIG = {
    'default_sync_interval': 24,  # hours
    'min_sync_interval': 1,       # hour
    'max_retries': 3,
    'retry_delay': 300,          # seconds
    'cleanup_interval': 7,       # days
    'log_retention': 30,         # days
}
```

## Security Considerations
1. Task authentication
2. Rate limit protection
3. Error handling
4. Audit logging

## Testing Strategy
1. Unit tests for scheduler logic
2. Integration tests for task execution
3. Rate limit compliance tests
4. Error handling scenarios

## Deployment Considerations
1. Multiple instance coordination
2. Database migration plan
3. Monitoring setup
4. Backup procedures

## Future Enhancements
1. Advanced scheduling patterns
2. Better error recovery
3. Performance optimization
4. Extended monitoring 