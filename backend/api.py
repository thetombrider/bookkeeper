"""
FastAPI Backend for Personal Finance Bookkeeper

This module implements the REST API endpoints for the bookkeeping application.
It provides endpoints for managing account categories, accounts, transactions,
journal entries, and generating financial reports.
"""

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

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI application instance
app = FastAPI(title="Personal Finance Bookkeeper")

# Configure CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def list_account_categories(db: Session = Depends(get_db)):
    """
    List all account categories.
    
    Returns a list of all account categories in the system.
    """
    service = BookkeepingService(db)
    return service.list_account_categories()

@app.post("/account-categories/", response_model=AccountCategoryResponse, tags=["account-categories"])
async def create_account_category(
    category_data: AccountCategoryCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new account category.
    
    Parameters:
    - category_data: Data for the new category (name and optional description)
    
    Returns the newly created account category.
    """
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
            raise HTTPException(
                status_code=404,
                detail=f"Account category with id {category_id} not found"
            )
        return updated_category
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@app.delete("/account-categories/{category_id}", tags=["account-categories"])
async def delete_account_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete an account category.
    
    If the category has associated accounts, returns a 400 error with details about which accounts
    are preventing the deletion.
    """
    service = BookkeepingService(db)
    try:
        result = service.delete_account_category(category_id)
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Account category with id {category_id} not found"
            )
        return {"status": "success", "message": "Category deleted successfully"}
    except ValueError as e:
        print(f"ValueError in delete_account_category: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=400,
            detail={"message": str(e), "type": "validation_error"}
        )
    except Exception as e:
        print(f"Unexpected error in delete_account_category: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=500,
            detail={"message": f"An unexpected error occurred: {str(e)}", "type": "server_error"}
        )

# Accounts Endpoints

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
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"message": str(e), "type": "validation_error"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"message": f"An unexpected error occurred: {str(e)}", "type": "server_error"}
        )

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
            raise HTTPException(
                status_code=404,
                detail={"message": f"Account with id {account_id} not found", "type": "not_found"}
            )
        return updated_account
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"message": str(e), "type": "validation_error"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"message": f"An unexpected error occurred: {str(e)}", "type": "server_error"}
        )

@app.delete("/accounts/{account_id}", tags=["accounts"])
async def delete_account(
    account_id: str,
    db: Session = Depends(get_db)
):
    """Delete an account."""
    service = BookkeepingService(db)
    try:
        if not service.delete_account(account_id):
            raise HTTPException(
                status_code=404,
                detail={"message": f"Account with id {account_id} not found", "type": "not_found"}
            )
        return {"status": "success", "message": "Account deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"message": str(e), "type": "validation_error"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"message": f"An unexpected error occurred: {str(e)}", "type": "server_error"}
        )

# Transactions Endpoints

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
    """
    Update an existing transaction.
    
    Parameters:
    - transaction_id: ID of the transaction to update
    - transaction_data: New transaction data including journal entries
    
    Returns the updated transaction with its journal entries.
    Validates that debits equal credits before updating.
    """
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
    """
    Delete a transaction and its associated journal entries.
    
    Parameters:
    - transaction_id: ID of the transaction to delete
    
    Returns no content (204) on successful deletion.
    Ensures all related journal entries are also deleted.
    """
    service = BookkeepingService(db)
    try:
        if not service.delete_transaction(transaction_id):
            raise HTTPException(status_code=404, detail="Transaction not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Reports Endpoints

@app.get("/balance-sheet/", response_model=BalanceSheet, tags=["reports"])
async def get_balance_sheet(
    as_of: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Generate a balance sheet report.
    
    Parameters:
    - as_of: Optional date for point-in-time balance sheet (defaults to current date)
    
    Returns a balance sheet showing:
    - Total assets
    - Total liabilities
    - Total equity
    - Detailed breakdown of each category
    """
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
    """
    Generate an income statement report for a specific period.
    
    Parameters:
    - start_date: Beginning of the reporting period
    - end_date: End of the reporting period
    
    Returns an income statement showing:
    - Total income
    - Total expenses
    - Net income
    - Detailed breakdown of income and expense accounts
    """
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