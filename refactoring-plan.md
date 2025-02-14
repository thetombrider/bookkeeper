# Backend Refactoring Plan

## Overview
This document outlines the step-by-step plan for refactoring the backend of the Bookkeeper application. The main goals are:
- Break down the monolithic `api.py` into smaller, focused modules
- Separate business logic into dedicated service classes
- Improve code organization and maintainability
- Make the codebase easier to test

## Phase 1: Project Structure Setup

1. Create new directory structure:
```
backend/
├── api/
│   ├── v1/
│   │   ├── endpoints/
│   │   │   ├── accounts.py
│   │   │   ├── transactions.py
│   │   │   ├── reports.py
│   │   │   └── imports/
│   │   │       ├── gocardless.py
│   │   │       └── tally.py
│   │   └── router.py
│   └── middleware/
│       └── rate_limit.py
└── services/
    ├── accounts.py
    ├── transactions.py
    ├── reports.py
    └── imports/
        ├── gocardless.py
        └── tally.py
```

2. Create empty `__init__.py` files in each directory
3. Set up base router in `api/v1/router.py`

## Phase 2: Service Layer Implementation

1. Break down `BookkeepingService` into specialized services:

### Account Service (`services/accounts.py`):
```python
class AccountService:
    - list_accounts()
    - create_account()
    - update_account()
    - delete_account()
    - get_account_balance()
    - list_categories()
    - create_category()
```

### Transaction Service (`services/transactions.py`):
```python
class TransactionService:
    - create_transaction()
    - update_transaction()
    - delete_transaction()
    - list_transactions()
    - get_transaction()
    - validate_transaction()
```

### Report Service (`services/reports.py`):
```python
class ReportService:
    - get_balance_sheet()
    - get_income_statement()
    - get_account_balances()
```

### Import Services (`services/imports/`):
```python
class GoCardlessService:
    - sync_transactions()
    - list_banks()
    - create_requisition()

class TallyService:
    - process_webhook()
    - create_staged_transaction()
```

## Phase 3: API Endpoint Refactoring

1. Move endpoints from `api.py` to their respective modules:

### Account Endpoints (`api/v1/endpoints/accounts.py`):
- GET /accounts/
- POST /accounts/
- PUT /accounts/{id}
- DELETE /accounts/{id}
- GET /account-categories/
- POST /account-categories/

### Transaction Endpoints (`api/v1/endpoints/transactions.py`):
- GET /transactions/
- POST /transactions/
- PUT /transactions/{id}
- DELETE /transactions/{id}
- GET /journal-entries/
- POST /journal-entries/

### Report Endpoints (`api/v1/endpoints/reports.py`):
- GET /balance-sheet/
- GET /income-statement/
- GET /accounts/balances/

### Import Endpoints (`api/v1/endpoints/imports/`):
- POST /import-sources/gocardless/sync
- GET /import-sources/gocardless/banks
- POST /webhooks/tally

## Phase 4: Middleware and Error Handling

1. Implement rate limiting middleware
2. Create custom exception handlers
3. Add request/response logging
4. Implement proper error responses

## Phase 5: Testing Setup

1. Create test directory structure:
```
tests/
├── api/
│   ├── test_accounts.py
│   ├── test_transactions.py
│   └── test_reports.py
├── services/
│   ├── test_account_service.py
│   ├── test_transaction_service.py
│   └── test_report_service.py
└── conftest.py
```

2. Set up test database configuration
3. Create fixtures for common test data
4. Write basic test cases for each service
5. Write integration tests for API endpoints

## Phase 6: Documentation

1. Update API documentation
2. Add docstrings to all services and endpoints
3. Create README files for each major component
4. Document testing procedures

## Implementation Order

1. Create new directory structure
2. Implement base service classes
3. Move account-related code first (as it's the foundation)
4. Move transaction-related code
5. Move reporting code
6. Move import-related code
7. Implement middleware
8. Set up testing
9. Update documentation

## Migration Strategy

1. Create new files alongside existing code
2. Gradually move functionality, one endpoint at a time
3. Test thoroughly after each move
4. Keep old code working until new code is verified
5. Remove old code only after successful testing

## Rollback Plan

1. Keep backup of original `api.py` and `services.py`
2. Maintain git history with clear commit messages
3. Test each change in development before deploying
4. Be prepared to revert to last working commit if needed

## Success Criteria

- All tests passing
- No regression in functionality
- Improved code organization
- Better error handling
- Comprehensive documentation
- Easier to maintain and extend

## Timeline Estimate

- Phase 1: 1 day
- Phase 2: 2-3 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days
- Phase 5: 2-3 days
- Phase 6: 1-2 days

Total: 9-14 days

## Git Branching Strategy

1. Create single refactoring branch:
```bash
git checkout -b refactor/backend
```

2. Commit Organization:
- Use clear, descriptive commit messages with prefixes:
  ```
  structure: Set up new directory layout
  service: Implement AccountService
  api: Move account endpoints
  test: Add account service tests
  ```
- Commit frequently with logical units of work
- Each commit should keep the application in a working state

3. Development Workflow:
- Work directly on `refactor/backend` branch
- Create commits per logical change (not per file)
- Test after each significant change
- Keep `main` branch untouched as backup
- Tag important milestones:
  ```bash
  git tag -a phase1-complete -m "Completed directory restructure"
  git tag -a phase2-complete -m "Completed service layer"
  ```

4. Backup Points:
- Create backup tags before major changes:
  ```bash
  git tag -a backup/pre-phase2 -m "Backup before service layer changes"
  ```
- Can easily restore to any tagged point if needed:
  ```bash
  git checkout backup/pre-phase2
  ```

5. Final Merge:
```bash
git checkout main
git merge refactor/backend --no-ff  # Creates a merge commit for clear history
```

## Notes

- Keep the application running during refactoring
- Make small, incremental changes
- Test thoroughly after each change
- Document all changes
- Update API clients as needed 