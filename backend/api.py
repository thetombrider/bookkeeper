from datetime import date
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from decimal import Decimal

from .models import (
    AccountCategoryCreate, AccountCategoryResponse,
    AccountCreate, AccountResponse,
    TransactionCreate, TransactionResponse,
    JournalEntryCreate, JournalEntryResponse,
    BalanceSheet, IncomeStatement
)
from .services import BookkeepingService
from .database import get_db, engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Personal Finance Bookkeeper")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/account-categories/", response_model=List[AccountCategoryResponse], tags=["account-categories"])
async def list_account_categories(db: Session = Depends(get_db)):
    """List all account categories."""
    service = BookkeepingService(db)
    return service.list_account_categories()

@app.post("/account-categories/", response_model=AccountCategoryResponse, tags=["account-categories"])
async def create_account_category(
    category_data: AccountCategoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new account category."""
    service = BookkeepingService(db)
    try:
        return service.create_account_category(category_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/account-categories/{category_id}", response_model=AccountCategoryResponse, tags=["account-categories"])
async def update_account_category(
    category_id: str,
    category_data: AccountCategoryCreate,
    db: Session = Depends(get_db)
):
    """Update an existing account category."""
    service = BookkeepingService(db)
    try:
        updated_category = service.update_account_category(category_id, category_data)
        if not updated_category:
            raise HTTPException(status_code=404, detail="Account category not found")
        return updated_category
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/account-categories/{category_id}", status_code=204, tags=["account-categories"])
async def delete_account_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    """Delete an account category."""
    service = BookkeepingService(db)
    try:
        if not service.delete_account_category(category_id):
            raise HTTPException(status_code=404, detail="Account category not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/accounts/", response_model=List[AccountResponse], tags=["accounts"])
async def list_accounts(
    category_id: Optional[str] = None,
    account_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all accounts, optionally filtered by category or type."""
    service = BookkeepingService(db)
    return service.list_accounts(category_id=category_id, account_type=account_type)

@app.post("/accounts/", response_model=AccountResponse, tags=["accounts"])
async def create_account(
    account_data: AccountCreate,
    db: Session = Depends(get_db)
):
    """Create a new account in the chart of accounts."""
    service = BookkeepingService(db)
    try:
        return service.create_account(account_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/accounts/{account_id}", response_model=AccountResponse, tags=["accounts"])
async def update_account(
    account_id: str,
    account_data: AccountCreate,
    db: Session = Depends(get_db)
):
    """Update an existing account."""
    service = BookkeepingService(db)
    try:
        updated_account = service.update_account(account_id, account_data)
        if not updated_account:
            raise HTTPException(status_code=404, detail="Account not found")
        return updated_account
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/accounts/{account_id}", status_code=204, tags=["accounts"])
async def delete_account(
    account_id: str,
    db: Session = Depends(get_db)
):
    """Delete an account."""
    service = BookkeepingService(db)
    try:
        if not service.delete_account(account_id):
            raise HTTPException(status_code=404, detail="Account not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/transactions/", response_model=TransactionResponse, tags=["transactions"])
async def create_transaction(
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Create a new transaction with journal entries."""
    service = BookkeepingService(db)
    try:
        return service.create_transaction(transaction_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/transactions/{transaction_id}", response_model=TransactionResponse, tags=["transactions"])
async def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific transaction with its journal entries."""
    service = BookkeepingService(db)
    transaction = service.get_transaction(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@app.get("/transactions/", response_model=List[TransactionResponse], tags=["transactions"])
async def list_transactions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """List all transactions, optionally filtered by date range."""
    service = BookkeepingService(db)
    return service.list_transactions(start_date=start_date, end_date=end_date)

@app.put("/transactions/{transaction_id}", response_model=TransactionResponse, tags=["transactions"])
async def update_transaction(
    transaction_id: str,
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db)
):
    """Update an existing transaction."""
    service = BookkeepingService(db)
    try:
        updated_transaction = service.update_transaction(transaction_id, transaction_data)
        if not updated_transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return updated_transaction
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/transactions/{transaction_id}", status_code=204, tags=["transactions"])
async def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Delete a transaction and its journal entries."""
    service = BookkeepingService(db)
    try:
        if not service.delete_transaction(transaction_id):
            raise HTTPException(status_code=404, detail="Transaction not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/balance-sheet/", response_model=BalanceSheet, tags=["reports"])
async def get_balance_sheet(
    as_of: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Generate a balance sheet as of a specific date."""
    service = BookkeepingService(db)
    try:
        return service.get_balance_sheet(as_of)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/income-statement/", response_model=IncomeStatement, tags=["reports"])
async def get_income_statement(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """Generate an income statement for a specific period."""
    service = BookkeepingService(db)
    try:
        return service.get_income_statement(start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/accounts/balances/", response_model=Dict[str, Decimal], tags=["accounts"])
async def get_account_balances(
    as_of: Optional[date] = None,
    category_id: Optional[str] = None,
    account_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get current balances for all accounts, optionally filtered by:
    - Category
    - Account type
    - Date (as of a specific date)
    Returns a dictionary of account IDs to their balances.
    """
    service = BookkeepingService(db)
    return service.get_account_balances(
        as_of=as_of,
        category_id=category_id,
        account_type=account_type
    )

@app.get("/accounts/{account_id}/balance", response_model=Decimal, tags=["accounts"])
async def get_account_balance(
    account_id: str,
    as_of: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get the current balance for a specific account, optionally as of a specific date."""
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
    """Update an existing journal entry."""
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
    """Delete a journal entry."""
    service = BookkeepingService(db)
    try:
        if not service.delete_journal_entry(entry_id):
            raise HTTPException(status_code=404, detail="Journal entry not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) 