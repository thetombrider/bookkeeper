"""
FastAPI Backend for Bookkeeper

This module implements the REST API endpoints for the bookkeeping application.
It provides endpoints for managing account categories, accounts, transactions,
journal entries, and generating financial reports.
"""

from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from decimal import Decimal
import os
import json
from uuid import uuid4
from nordigen import NordigenClient
import time
from collections import defaultdict

from . import models
from .models import (
    AccountCategoryCreate, AccountCategoryResponse,
    AccountCreate, AccountResponse,
    TransactionCreate, TransactionResponse,
    JournalEntryCreate, JournalEntryResponse,
    BalanceSheet, IncomeStatement,
    ImportSourceCreate, ImportSourceResponse,
    StagedTransactionCreate, StagedTransactionResponse,
    ImportStatus
)
from .services import BookkeepingService
from .database import get_db, engine, Base
from .auth import (
    User, UserCreate, UserResponse, Token,
    create_access_token, authenticate_user, create_user,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Add rate limiting tracking
_api_call_counts = defaultdict(list)
_MAX_CALLS_PER_DAY = 10
_CALLS_RESET_AFTER = timedelta(days=1)

def check_rate_limit(resource_key):
    """Check if we've exceeded rate limits for a resource."""
    global _api_call_counts
    
    now = datetime.now()
    # Clean up old calls
    _api_call_counts[resource_key] = [
        timestamp for timestamp in _api_call_counts[resource_key]
        if now - timestamp < _CALLS_RESET_AFTER
    ]
    
    # Check if we've exceeded the limit
    if len(_api_call_counts[resource_key]) >= _MAX_CALLS_PER_DAY:
        oldest_call = min(_api_call_counts[resource_key])
        reset_time = oldest_call + _CALLS_RESET_AFTER
        wait_seconds = int((reset_time - now).total_seconds())
        return False, wait_seconds
    
    # Add new call
    _api_call_counts[resource_key].append(now)
    return True, 0

def get_bank_transactions(account, account_id=None, start_date=None, end_date=None):
    """
    Retrieve transactions for a specific account with improved rate limit handling.
    Args:
        account: The GoCardless AccountApi object
        account_id: The account ID string (from requisition)
        start_date: Optional start date for transaction filtering
        end_date: Optional end date for transaction filtering
    """
    try:
        if not account_id:
            print(f"Warning: No account_id provided for transaction fetch")
            account_id = "unknown"
        
        # Generate unique key for this account's rate limiting
        rate_limit_key = f"transactions_{account_id}"
        
        # Check rate limit before making the call
        can_proceed, wait_time = check_rate_limit(rate_limit_key)
        if not can_proceed:
            print(f"Rate limit would be exceeded for account {account_id}. Need to wait {wait_time} seconds.")
            return []
        
        try:
            transactions = account.get_transactions()
            
            if not transactions:
                return []
                
            if not isinstance(transactions, dict):
                return []
                
            booked = transactions.get('transactions', {}).get('booked', [])
            pending = transactions.get('transactions', {}).get('pending', [])
            
            return booked + pending
            
        except Exception as e:
            error_data = getattr(e, 'response', {})
            if isinstance(error_data, dict):
                status = error_data.get('status')
                if status == 403:  # Access forbidden
                    print(f"Access forbidden for account {account_id}: {str(e)}")
                    raise ValueError("Access forbidden")
                elif status == 429:  # Rate limit exceeded
                    # Remove the last call we just added since it failed
                    if _api_call_counts[rate_limit_key]:
                        _api_call_counts[rate_limit_key].pop()
                    wait_time = int(error_data.get('detail', '').split()[-2]) + 1
                    print(f"Rate limit hit for account {account_id}, would need to wait {wait_time} seconds")
                    return []
            
            print(f"Error retrieving transactions for account {account_id}: {str(e)}")
            return []
            
    except ValueError as ve:
        raise ve
    except Exception as e:
        print(f"Error retrieving transactions: {str(e)}")
        return []

def get_bank_accounts(client, institution_id):
    """
    Get accounts for a specific bank.
    """
    try:
        requisition = client.requisition.get_requisition_by_id(
            requisition_id=institution_id
        )
        
        if not requisition or not requisition.get('accounts', []):
            return []
        
        accounts = []
        for account_id in requisition['accounts']:
            try:
                account = client.account_api(account_id)
                details = account.get_details()
                account_info = details.get('account', {})
                
                accounts.append({
                    'id': account_id,
                    'name': account_info.get('ownerName', 'Unknown'),
                    'iban': account_info.get('iban', 'Not available'),
                    'currency': account_info.get('currency', 'Unknown'),
                    'product': account_info.get('product', ''),
                    'account_api': account
                })
            except Exception as e:
                print(f"Error processing account {account_id}: {str(e)}")
                continue
                
        return accounts
    except Exception as e:
        print(f"Error retrieving accounts: {e}")
        return []

def list_connected_banks(client):
    """
    List banks that have active requisitions.
    """
    try:
        # Get all requisitions for this client
        requisitions = client.requisition.get_requisitions()
        
        if not requisitions:
            return []
            
        banks = []
        for req in requisitions:
            if not isinstance(req, dict):
                continue
                
            if req.get('status') == 'LN':  # Only include linked/active requisitions
                try:
                    institution_id = req.get('institution_id')
                    if not institution_id:
                        continue
                        
                    institution = client.institution.get_institution_by_id(institution_id)
                    if institution and isinstance(institution, dict):
                        banks.append({
                            'id': institution.get('id'),
                            'name': institution.get('name'),
                            'requisition_id': req.get('id')
                        })
                except Exception as e:
                    print(f"Error processing bank {req.get('institution_id', 'unknown')}: {str(e)}")
                    continue
                    
        return banks
    except Exception as e:
        print(f"Error listing connected banks: {str(e)}")
        return []

# Create FastAPI application instance
app = FastAPI(title="Bookkeeper")

# Configure CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend development server
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "accept"],
)

# Add health endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Authentication endpoints
@app.post("/register", response_model=UserResponse, tags=["auth"])
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    return create_user(db=db, user=user_data)

@app.post("/token", response_model=Token, tags=["auth"])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login to get access token."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse, tags=["auth"])
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user

# Create runs directory if it doesn't exist
RUNS_DIR = "runs"
os.makedirs(RUNS_DIR, exist_ok=True)

# Initialize service
service = BookkeepingService(None)  # DB session will be injected per request

# Journal Entries Endpoints

@app.get("/journal-entries/", response_model=List[JournalEntryResponse], tags=["journal-entries"])
async def list_journal_entries(
    account_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    List journal entries with optional filters:
    - By account
    - By date range
    
    Returns a list of journal entries matching the specified criteria.
    """
    service = BookkeepingService(db)
    return service.list_journal_entries(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )

@app.get("/journal-entries/{account_id}", response_model=List[JournalEntryResponse], tags=["journal-entries"])
async def get_account_journal_entries(
    account_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get all journal entries for a specific account, optionally filtered by date range."""
    service = BookkeepingService(db)
    # First verify the account exists
    account = service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    return service.list_journal_entries(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )

# Account Categories Endpoints
@app.get("/account-categories/", response_model=List[AccountCategoryResponse], tags=["account-categories"])
async def list_account_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all account categories for the current user."""
    service = BookkeepingService(db, user_id=current_user.id)
    return service.list_account_categories()

@app.post("/account-categories/", response_model=AccountCategoryResponse, tags=["account-categories"])
async def create_account_category(
    category_data: AccountCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new account category."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.create_account_category(category_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/account-categories/{category_id}", response_model=AccountCategoryResponse, tags=["account-categories"])
async def get_account_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific account category."""
    service = BookkeepingService(db, user_id=current_user.id)
    category = service.get_account_category(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@app.put("/account-categories/{category_id}", response_model=AccountCategoryResponse, tags=["account-categories"])
async def update_account_category(
    category_id: str,
    category_data: AccountCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing account category."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        updated_category = service.update_account_category(category_id, category_data)
        if not updated_category:
            raise HTTPException(
                status_code=404,
                detail=f"Account category with id {category_id} not found"
            )
        return updated_category
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/account-categories/{category_id}", tags=["account-categories"])
async def delete_account_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an account category."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        if not service.delete_account_category(category_id):
            raise HTTPException(
                status_code=404,
                detail=f"Account category with id {category_id} not found"
            )
        return {"status": "success", "message": "Category deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Accounts Endpoints
@app.get("/accounts/", response_model=List[AccountResponse], tags=["accounts"])
async def list_accounts(
    category_id: Optional[str] = None,
    account_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all accounts for the current user."""
    service = BookkeepingService(db, user_id=current_user.id)
    return service.list_accounts(category_id=category_id, account_type=account_type)

@app.get("/accounts/{account_id}", response_model=AccountResponse, tags=["accounts"])
async def get_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific account."""
    service = BookkeepingService(db, user_id=current_user.id)
    account = service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@app.post("/accounts/", response_model=AccountResponse, tags=["accounts"])
async def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new account."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.create_account(account_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/accounts/{account_id}", response_model=AccountResponse, tags=["accounts"])
async def update_account(
    account_id: str,
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing account."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        updated_account = service.update_account(account_id, account_data)
        if not updated_account:
            raise HTTPException(status_code=404, detail="Account not found")
        return updated_account
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/accounts/{account_id}", tags=["accounts"])
async def delete_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an account."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        if not service.delete_account(account_id):
            raise HTTPException(status_code=404, detail="Account not found")
        return {"status": "success", "message": "Account deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Transactions Endpoints
@app.get("/transactions/", response_model=List[TransactionResponse], tags=["transactions"])
async def list_transactions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[str] = None,
    account_filter_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all transactions for the current user."""
    service = BookkeepingService(db, user_id=current_user.id)
    return service.list_transactions(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        account_filter_type=account_filter_type
    )

@app.get("/transactions/{transaction_id}", response_model=TransactionResponse, tags=["transactions"])
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific transaction."""
    service = BookkeepingService(db, user_id=current_user.id)
    transaction = service.get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@app.post("/transactions/", response_model=TransactionResponse, tags=["transactions"])
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new transaction."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.create_transaction(transaction_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/transactions/{transaction_id}", response_model=TransactionResponse, tags=["transactions"])
async def update_transaction(
    transaction_id: str,
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing transaction."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        updated_transaction = service.update_transaction(transaction_id, transaction_data)
        if not updated_transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return updated_transaction
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/transactions/{transaction_id}", tags=["transactions"])
async def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transaction."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        if not service.delete_transaction(transaction_id):
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"status": "success", "message": "Transaction deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Reports Endpoints
@app.get("/balance-sheet/", response_model=BalanceSheet, tags=["reports"])
async def get_balance_sheet(
    as_of: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get balance sheet for the current user."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.get_balance_sheet(as_of)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/income-statement/", response_model=IncomeStatement, tags=["reports"])
async def get_income_statement(
    start_date: date,
    end_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get income statement for the current user."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.get_income_statement(start_date, end_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts/balances/", response_model=Dict[str, Decimal], tags=["accounts"])
async def get_account_balances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current balances for all accounts."""
    service = BookkeepingService(db, user_id=current_user.id)
    try:
        return service.get_account_balances()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts/{account_id}/balance", response_model=Decimal, tags=["accounts"])
async def get_account_balance(
    account_id: str,
    as_of: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Get the current balance for a specific account.
    
    Parameters:
    - account_id: ID of the account to get balance for
    - as_of: Optional date for historical balance lookup
    
    Returns the account balance as a decimal number.
    Positive numbers indicate debit balances, negative numbers indicate credit balances.
    """
    service = BookkeepingService(db)
    # First verify the account exists
    account = service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    balance = service.get_account_balance(account_id, as_of)
    return balance

@app.put("/journal-entries/{entry_id}", response_model=JournalEntryResponse, tags=["journal-entries"])
async def update_journal_entry(
    entry_id: str,
    entry_data: JournalEntryCreate,
    db: Session = Depends(get_db)
):
    """
    Update an existing journal entry.
    
    Parameters:
    - entry_id: ID of the journal entry to update
    - entry_data: New journal entry data
    
    Returns the updated journal entry.
    Ensures the parent transaction remains balanced after the update.
    """
    service = BookkeepingService(db)
    try:
        updated_entry = service.update_journal_entry(entry_id, entry_data)
        if not updated_entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        return updated_entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/journal-entries/{entry_id}", status_code=204, tags=["journal-entries"])
async def delete_journal_entry(
    entry_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a journal entry.
    
    Parameters:
    - entry_id: ID of the journal entry to delete
    
    Returns no content (204) on successful deletion.
    Validates that the parent transaction remains balanced after deletion.
    """
    service = BookkeepingService(db)
    try:
        if not service.delete_journal_entry(entry_id):
            raise HTTPException(status_code=404, detail="Journal entry not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Import Sources Endpoints
@app.post("/import-sources/", response_model=ImportSourceResponse, tags=["imports"])
async def create_import_source(
    source_data: ImportSourceCreate,
    db: Session = Depends(get_db)
):
    """Create a new import source configuration."""
    service = BookkeepingService(db)
    try:
        return service.create_import_source(source_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/import-sources/", response_model=List[ImportSourceResponse], tags=["imports"])
async def list_import_sources(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all import sources."""
    service = BookkeepingService(db)
    return service.list_import_sources(active_only=active_only)

@app.get("/import-sources/{source_id}", response_model=ImportSourceResponse, tags=["imports"])
async def get_import_source(
    source_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific import source configuration."""
    service = BookkeepingService(db)
    source = service.get_import_source(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Import source not found")
    return source

@app.put("/import-sources/{source_id}", response_model=ImportSourceResponse, tags=["imports"])
async def update_import_source(
    source_id: str,
    source_data: ImportSourceCreate,
    db: Session = Depends(get_db)
):
    """Update an import source configuration."""
    service = BookkeepingService(db)
    try:
        updated_source = service.update_import_source(source_id, source_data)
        if not updated_source:
            raise HTTPException(status_code=404, detail="Import source not found")
        return updated_source
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/import-sources/{source_id}", status_code=204, tags=["imports"])
async def delete_import_source(
    source_id: str,
    db: Session = Depends(get_db)
):
    """Delete an import source configuration."""
    service = BookkeepingService(db)
    try:
        if not service.delete_import_source(source_id):
            raise HTTPException(status_code=404, detail="Import source not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Staged Transactions Endpoints
@app.post("/staged-transactions/", response_model=StagedTransactionResponse, tags=["imports"])
async def create_staged_transaction(
    transaction_data: StagedTransactionCreate,
    db: Session = Depends(get_db)
):
    """Create a new staged transaction."""
    service = BookkeepingService(db)
    try:
        return service.create_staged_transaction(transaction_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/staged-transactions/", response_model=List[StagedTransactionResponse], tags=["imports"])
async def list_staged_transactions(
    source_id: Optional[str] = None,
    status: Optional[ImportStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """List staged transactions with optional filtering."""
    service = BookkeepingService(db)
    return service.list_staged_transactions(
        source_id=source_id,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

@app.post("/staged-transactions/{staged_id}/process", response_model=TransactionResponse, tags=["imports"])
async def process_staged_transaction(
    staged_id: str,
    counterpart_account_id: str,
    db: Session = Depends(get_db)
):
    """Process a staged transaction by creating a proper double-entry transaction."""
    service = BookkeepingService(db)
    try:
        return service.process_staged_transaction(staged_id, counterpart_account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/staged-transactions/bulk-process", tags=["imports"])
async def bulk_process_staged_transactions(
    staged_ids: List[str],
    counterpart_account_id: str,
    db: Session = Depends(get_db)
):
    """Process multiple staged transactions at once."""
    service = BookkeepingService(db)
    try:
        successful, errors = service.bulk_process_staged_transactions(staged_ids, counterpart_account_id)
        return {
            "success": len(successful),
            "errors": len(errors),
            "error_details": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/staged-transactions/bulk-delete", tags=["imports"])
async def bulk_delete_staged_transactions(
    request: models.BulkDeleteRequest,
    db: Session = Depends(get_db)
):
    """Delete multiple staged transactions at once."""
    service = BookkeepingService(db)
    try:
        successful, errors = service.bulk_delete_staged_transactions(request.staged_ids)
        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Some transactions could not be deleted",
                    "success": len(successful),
                    "errors": len(errors),
                    "error_details": errors
                }
            )
        return {"message": "All transactions deleted successfully", "count": len(successful)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/staged-transactions/{staged_id}", status_code=204, tags=["imports"])
async def delete_staged_transaction(
    staged_id: str,
    db: Session = Depends(get_db)
):
    """Delete a staged transaction."""
    service = BookkeepingService(db)
    try:
        if not service.delete_staged_transaction(staged_id):
            raise HTTPException(status_code=404, detail="Staged transaction not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Webhook endpoint for Tally
@app.post("/webhooks/tally", tags=["imports"])
async def tally_webhook(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint for receiving transactions from Tally.
    Expected fields in the form:
    - Data: date field (transaction date)
    - Mese: string (month reference)
    - Causale: string (transaction description)
    - Categoria: string (transaction category)
    - Conto: string (account name)
    - Direzione: string (Entrata/Uscita)
    - Importo Entrata: float (credit amount, mutually exclusive with importo uscita)
    - Importo Uscita: float (debit amount, mutually exclusive with importo entrata)
    - Inserisci la ricevuta: file attachment (optional)
    """
    service = BookkeepingService(db)
    try:
        # Find the Tally import source
        source = service.db.query(models.ImportSource).filter(
            models.ImportSource.type == models.ImportSourceType.TALLY,
            models.ImportSource.is_active == True
        ).first()
        
        if not source:
            raise HTTPException(status_code=400, detail="No active Tally import source configured")
        
        # Extract fields from Tally payload
        form_fields = {field["label"]: field for field in payload["data"]["fields"]}
        
        # Get the selected values for dropdowns
        def get_selected_text(field):
            if not field["value"]:
                return None
            selected_id = field["value"][0]  # Get first selected option
            for option in field["options"]:
                if option["id"] == selected_id:
                    return option["text"]
            return None

        # Extract amounts - they are mutually exclusive
        importo_entrata = float(form_fields.get("Importo Entrata", {}).get("value") or 0)
        importo_uscita = float(form_fields.get("Importo Uscita", {}).get("value") or 0)
        
        # Determine if this is a credit or debit entry
        is_credit = importo_entrata > 0
        amount = importo_entrata if is_credit else importo_uscita
        
        if amount == 0:
            raise HTTPException(status_code=400, detail="Transaction must have either a credit or debit amount")
        
        # Get receipt file URL if present
        ricevuta_field = form_fields.get("Inserisci la ricevuta", {})
        ricevuta_url = ricevuta_field.get("value", [{}])[0].get("url") if ricevuta_field.get("value") else None
        
        # Create staged transaction
        staged_data = models.StagedTransactionCreate(
            source_id=source.id,
            external_id=payload["data"]["submissionId"],
            transaction_date=date.fromisoformat(form_fields["Data"]["value"]),
            description=f"{form_fields['Causale']['value']} - {get_selected_text(form_fields['Mese'])}".strip(' -'),
            amount=Decimal(str(amount)),
            raw_data=json.dumps({
                "mese": get_selected_text(form_fields["Mese"]),
                "categoria": get_selected_text(form_fields["Categoria"]),
                "conto": get_selected_text(form_fields["Conto"]),
                "direzione": get_selected_text(form_fields["Direzione"]),
                "receipt_url": ricevuta_url,
                "is_credit": is_credit
            })
        )
        
        staged_transaction = service.create_staged_transaction(staged_data)
        
        return {
            "status": "success",
            "message": "Transaction staged successfully",
            "data": {
                "id": staged_transaction.id,
                "amount": amount,
                "is_credit": is_credit,
                "description": staged_transaction.description,
                "date": staged_transaction.transaction_date.isoformat()
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import-sources/{source_id}/sync-gocardless", tags=["imports"])
async def sync_gocardless(
    source_id: str,
    db: Session = Depends(get_db)
):
    """
    Sync transactions from GoCardless for a specific import source.
    The source must be of type 'gocardless' and have valid configuration.
    """
    try:
        # Get the import source
        source = db.query(models.ImportSource).filter(
            models.ImportSource.id == source_id,
            models.ImportSource.type == models.ImportSourceType.GOCARDLESS
        ).first()
        
        if not source:
            raise HTTPException(status_code=404, detail="GoCardless import source not found")
        
        if not source.is_active:
            raise HTTPException(status_code=400, detail="Import source is not active")
        
        # Parse the config
        try:
            config = json.loads(source.config) if source.config else {}
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid source configuration")

        if not isinstance(config, dict):
            raise HTTPException(status_code=400, detail="Invalid configuration format")
            
        if not config.get('secretId') or not config.get('secretKey'):
            raise HTTPException(
                status_code=400, 
                detail="Missing GoCardless credentials in configuration"
            )
        
        # Initialize GoCardless client
        client = NordigenClient(
            secret_id=config['secretId'],
            secret_key=config['secretKey']
        )

        # Initialize tokens with retry
        max_retries = 3
        retry_delay = 1
        token_error = None
        
        for attempt in range(max_retries):
            try:
                token_data = client.generate_token()
                client.token = token_data['access']
                token_error = None
                break
            except Exception as e:
                token_error = str(e)
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
        
        if token_error:
            raise HTTPException(status_code=400, detail=f"Failed to generate GoCardless token: {token_error}")
        
        # Get transactions from all connected accounts
        staged_transactions = []
        errors = []
        rate_limited_accounts = []
        
        # Get active bank connections
        bank_connections = db.query(models.BankConnection).filter(
            models.BankConnection.import_source_id == source_id,
            models.BankConnection.status == 'active'
        ).all()
        
        for connection in bank_connections:
            try:
                # Get requisition details and check status
                requisition = client.requisition.get_requisition_by_id(
                    requisition_id=connection.requisition_id
                )
                
                # Check if requisition needs to be reauthorized
                if requisition['status'] != 'LN' or 'access_expired' in requisition.get('status_description', '').lower():
                    connection.status = 'disconnected'
                    db.commit()
                    errors.append(f"Connection {connection.bank_name} needs to be reauthorized")
                    continue
                
                # Get accounts for this requisition
                for account_id in requisition.get('accounts', []):
                    try:
                        account = client.account_api(account_id)
                        
                        # Check if we already have this account in our database
                        bank_account = db.query(models.BankAccount).filter(
                            models.BankAccount.account_id == account_id,
                            models.BankAccount.connection_id == connection.id
                        ).first()
                        
                        if not bank_account:
                            # Create new bank account record
                            details = account.get_details()
                            bank_account = models.BankAccount(
                                connection_id=connection.id,
                                account_id=account_id,
                                name=details.get('account', {}).get('name', 'Unknown Account'),
                                iban=details.get('account', {}).get('iban'),
                                currency=details.get('account', {}).get('currency'),
                                status='active'
                            )
                            db.add(bank_account)
                            db.commit()
                        
                        try:
                            transactions = get_bank_transactions(account, account_id=account_id)
                            if not transactions:
                                rate_limited_accounts.append(account_id)
                                continue
                            
                            # Convert each transaction to a staged transaction
                            for tx in transactions:
                                try:
                                    # Skip if transaction already exists
                                    existing = db.query(models.StagedTransaction).filter(
                                        models.StagedTransaction.source_id == source_id,
                                        models.StagedTransaction.external_id == tx.get('transactionId')
                                    ).first()
                                    
                                    if existing:
                                        continue
                                    
                                    staged_data = models.StagedTransactionCreate(
                                        source_id=source_id,
                                        external_id=tx.get('transactionId'),
                                        transaction_date=datetime.strptime(tx['bookingDate'], '%Y-%m-%d').date(),
                                        description=tx.get('remittanceInformationUnstructured', 'No description'),
                                        amount=Decimal(tx['transactionAmount']['amount']),
                                        account_id=None,  # Will be set during processing
                                        raw_data=json.dumps(tx)
                                    )
                                    
                                    # Create staged transaction
                                    service = BookkeepingService(db)
                                    staged_tx = service.create_staged_transaction(staged_data)
                                    staged_transactions.append(staged_tx)
                                    
                                except Exception as e:
                                    errors.append(f"Error creating staged transaction: {str(e)}")
                                    continue
                                    
                        except ValueError as ve:
                            if "Access forbidden" in str(ve):
                                connection.status = 'disconnected'
                                db.commit()
                                errors.append(f"Access to account {account_id} is forbidden. Please reauthorize the connection.")
                            continue
                            
                    except Exception as e:
                        errors.append(f"Error processing account {account_id}: {str(e)}")
                        continue
                        
            except Exception as e:
                errors.append(f"Error processing bank connection {connection.requisition_id}: {str(e)}")
                continue
        
        response = {
            "message": f"Successfully synced {len(staged_transactions)} transactions from GoCardless",
            "transactions_count": len(staged_transactions),
            "errors": errors if errors else None
        }
        
        if rate_limited_accounts:
            response["rate_limited"] = {
                "message": "Some accounts were skipped due to rate limits",
                "accounts": rate_limited_accounts,
                "retry_after": "24 hours"
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error syncing transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/import-sources/{source_id}/gocardless-banks", tags=["imports"])
async def list_gocardless_banks(
    source_id: str,
    country: str = 'IT',
    db: Session = Depends(get_db)
):
    """
    List available banks for GoCardless integration.
    """
    try:
        # Get the source
        source = db.query(models.ImportSource).filter(
            models.ImportSource.id == source_id,
            models.ImportSource.type == models.ImportSourceType.GOCARDLESS
        ).first()
        
        if not source:
            raise HTTPException(status_code=404, detail="GoCardless import source not found")
        
        if not source.is_active:
            raise HTTPException(status_code=400, detail="Import source is not active")
        
        # Parse the config
        config = json.loads(source.config)
        if not config.get('secretId') or not config.get('secretKey'):
            raise HTTPException(
                status_code=400, 
                detail="Missing GoCardless credentials in configuration"
            )
        
        # Initialize GoCardless client
        client = NordigenClient(
            secret_id=config['secretId'],
            secret_key=config['secretKey']
        )
        
        # Generate new tokens
        token_data = client.generate_token()
        if not token_data or 'access' not in token_data:
            raise HTTPException(status_code=401, detail="Failed to generate access token")
        
        # Set the access token
        client.token = token_data['access']
        
        # Get institutions for the specified country
        try:
            institutions = client.institution.get_institutions(country)
            return institutions
        except Exception as e:
            if hasattr(e, 'response'):
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=e.response.json()
                )
            raise HTTPException(status_code=500, detail=str(e))
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import-sources/{source_id}/gocardless-requisition", tags=["imports"])
async def create_gocardless_requisition(
    source_id: str,
    request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Create a new Nordigen requisition for bank access."""
    try:
        # Get the import source
        source = db.query(models.ImportSource).filter_by(id=source_id).first()
        if not source:
            raise HTTPException(status_code=404, detail="Import source not found")
        
        # Parse config
        config = json.loads(source.config)
        if not config.get('secretId') or not config.get('secretKey'):
            raise HTTPException(
                status_code=400,
                detail="Missing Nordigen credentials in import source configuration"
            )
        
        # Initialize Nordigen client
        client = NordigenClient(
            secret_id=config['secretId'],
            secret_key=config['secretKey']
        )
        
        # Generate new tokens
        token_data = client.generate_token()
        client.token = token_data['access']
        
        # Get bank ID from request
        bank_id = request.get('bank_id')
        if not bank_id:
            raise HTTPException(status_code=400, detail="bank_id is required")
        
        # Get redirect URL from request
        redirect_url = request.get('redirect_url')
        if not redirect_url:
            raise HTTPException(status_code=400, detail="redirect_url is required")
        
        try:
            # Initialize session with the bank
            init = client.initialize_session(
                institution_id=bank_id,
                redirect_uri=redirect_url,
                reference_id=f"bookkeeper-{source_id}-{uuid4().hex[:8]}"
            )
            
            # Get bank details
            institution = client.institution.get_institution_by_id(bank_id)
            
            # Store bank connection
            db_connection = models.BankConnection(
                import_source_id=source_id,
                bank_id=bank_id,
                bank_name=institution['name'],
                requisition_id=init.requisition_id,
                status='pending'
            )
            db.add(db_connection)
            db.commit()
            
            return {
                "link": init.link,
                "requisition_id": init.requisition_id
            }
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create Nordigen requisition: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/import-sources/{source_id}/gocardless-accounts", tags=["imports"])
async def list_gocardless_accounts(
    source_id: str,
    use_cached: bool = False,
    refresh: bool = False,
    db: Session = Depends(get_db)
):
    try:
        # Get the import source
        source = db.query(models.ImportSource).filter(
            models.ImportSource.id == source_id,
            models.ImportSource.type == models.ImportSourceType.GOCARDLESS
        ).first()
        
        if not source:
            raise HTTPException(status_code=404, detail="GoCardless import source not found")
        
        if not source.is_active:
            raise HTTPException(status_code=400, detail="Import source is not active")
        
        # Parse the config
        try:
            config = json.loads(source.config) if source.config else {}
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid source configuration")

        if not isinstance(config, dict):
            raise HTTPException(status_code=400, detail="Invalid configuration format")
            
        if not config.get('secretId') or not config.get('secretKey'):
            raise HTTPException(
                status_code=400, 
                detail="Missing GoCardless credentials in configuration"
            )

        # Initialize GoCardless client
        client = NordigenClient(
            secret_id=config['secretId'],
            secret_key=config['secretKey']
        )

        # Get token
        try:
            token_data = client.generate_token()
            client.token = token_data['access']
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to generate GoCardless token: {str(e)}")

        # If use_cached is True and not forcing refresh, try to get accounts from database first
        if use_cached and not refresh:
            # Get active bank connections
            bank_connections = db.query(models.BankConnection).filter(
                models.BankConnection.import_source_id == source_id,
                models.BankConnection.status == 'active'
            ).all()

            if bank_connections:
                # Get accounts for all active connections
                accounts = []
                for conn in bank_connections:
                    bank_accounts = db.query(models.BankAccount).filter(
                        models.BankAccount.connection_id == conn.id,
                        models.BankAccount.status == 'active'
                    ).all()
                    
                    # Add connection info to each account
                    for account in bank_accounts:
                        account_data = models.BankAccountResponse.model_validate(account).model_dump()
                        account_data['connection'] = models.BankConnectionResponse.model_validate(conn).model_dump()
                        accounts.append(account_data)

                if accounts:
                    return accounts

        # If no cached accounts or refresh requested, fetch from API
        accounts = []
        bank_connections = db.query(models.BankConnection).filter(
            models.BankConnection.import_source_id == source_id,
            models.BankConnection.status == 'active'
        ).all()

        for connection in bank_connections:
            try:
                # Get requisition details
                requisition = client.requisition.get_requisition_by_id(
                    requisition_id=connection.requisition_id
                )

                # Update connection status if needed
                if requisition['status'] == 'LN':
                    connection.status = 'active'
                    db.commit()

                # Get accounts for this requisition
                for account_id in requisition.get('accounts', []):
                    try:
                        # Get account details from API
                        account_details = client.account.get_details(account_id)
                        
                        # Check if account already exists in database
                        bank_account = db.query(models.BankAccount).filter(
                            models.BankAccount.connection_id == connection.id,
                            models.BankAccount.account_id == account_id
                        ).first()

                        if not bank_account:
                            # Create new account record
                            bank_account = models.BankAccount(
                                connection_id=connection.id,
                                account_id=account_id,
                                name=account_details.get('account', {}).get('name', 'Unknown Account'),
                                iban=account_details.get('account', {}).get('iban'),
                                currency=account_details.get('account', {}).get('currency'),
                                status='active'
                            )
                            db.add(bank_account)
                            db.commit()
                            db.refresh(bank_account)

                        # Add account with connection info
                        account_data = models.BankAccountResponse.model_validate(bank_account).model_dump()
                        account_data['connection'] = models.BankConnectionResponse.model_validate(connection).model_dump()
                        accounts.append(account_data)

                    except Exception as e:
                        print(f"Error fetching account details for {account_id}: {str(e)}")
                        continue

            except Exception as e:
                print(f"Error processing connection {connection.id}: {str(e)}")
                continue

        return accounts

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing connected banks: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list connected banks")

@app.delete("/import-sources/{source_id}/gocardless-requisition/{requisition_id}", tags=["imports"])
async def delete_gocardless_requisition(
    source_id: str,
    requisition_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark a bank connection as disconnected.
    """
    try:
        connection = db.query(models.BankConnection).filter(
            models.BankConnection.import_source_id == source_id,
            models.BankConnection.requisition_id == requisition_id
        ).first()
        
        if not connection:
            raise HTTPException(status_code=404, detail="Bank connection not found")
        
        # Mark connection and its accounts as disconnected
        connection.status = 'disconnected'
        for account in connection.bank_accounts:
            account.status = 'disconnected'
        
        db.commit()
        return {"status": "success"}
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 