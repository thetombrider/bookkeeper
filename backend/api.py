"""
FastAPI Backend for Bookkeeper

This module implements the REST API endpoints for the bookkeeping application.
It provides endpoints for managing account categories, accounts, transactions,
journal entries, and generating financial reports.
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from decimal import Decimal
import os
import json
from uuid import uuid4
from nordigen import NordigenClient

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

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Helper functions for GoCardless integration
def get_bank_transactions(account, start_date=None, end_date=None):
    """
    Retrieve transactions for a specific account.
    """
    try:
        transactions = account.get_transactions()
        if not isinstance(transactions, dict) or 'transactions' not in transactions:
            return []
        
        booked = transactions.get('transactions', {}).get('booked', [])
        pending = transactions.get('transactions', {}).get('pending', [])
        
        return booked + pending
    except Exception as e:
        print(f"Error retrieving transactions: {e}")
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
            if req.get('status') == 'LN':  # Only include linked/active requisitions
                try:
                    institution = client.institution.get_institution_by_id(req['institution_id'])
                    if institution:
                        banks.append({
                            'id': institution['id'],
                            'name': institution['name'],
                            'requisition_id': req['id']
                        })
                except Exception as e:
                    print(f"Error processing bank {req['institution_id']}: {str(e)}")
                    continue
                    
        return banks
    except Exception as e:
        print(f"Error listing connected banks: {e}")
        return []

# Create FastAPI application instance
app = FastAPI(title="Bookkeeper")

# Configure CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/accounts/{account_id}", response_model=AccountResponse, tags=["accounts"])
async def get_account(
    account_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific account by ID."""
    service = BookkeepingService(db)
    account = service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

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
    account_id: Optional[str] = None,
    account_filter_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all transactions, optionally filtered by date range and account."""
    service = BookkeepingService(db)
    return service.list_transactions(
        start_date=start_date,
        end_date=end_date,
        account_id=account_id,
        account_filter_type=account_filter_type
    )

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
    Logs debug information to a file in the runs directory.
    """
    # Create a log file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(RUNS_DIR, f"income_statement_run_{timestamp}.log")
    
    try:
        service = BookkeepingService(db)
        
        # Redirect print statements to log file
        with open(log_file, "w") as f:
            # Log run parameters
            f.write(f"Income Statement Generation Run\n")
            f.write(f"Timestamp: {datetime.now()}\n")
            f.write(f"Period: {start_date} to {end_date}\n\n")
            
            # Get income statement with logging
            result = service.get_income_statement(
                start_date, 
                end_date, 
                log_file=f
            )
            
            f.write("\nRun completed successfully\n")
        
        return result
        
    except Exception as e:
        # Log any errors
        with open(log_file, "a") as f:
            f.write(f"\nError occurred: {str(e)}\n")
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
    - data: date field (transaction date)
    - mese: string (month reference)
    - causale: string (transaction description)
    - categoria: string (transaction category)
    - conto: string (account name)
    - importo entrata: float (credit amount, mutually exclusive with importo uscita)
    - importo uscita: float (debit amount, mutually exclusive with importo entrata)
    - ricevuta: file attachment (optional)
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
        fields = {field["label"].lower(): field["value"] for field in payload["data"]["fields"]}
        
        # Extract amounts - they are mutually exclusive
        importo_entrata = float(fields.get("importo entrata", 0))
        importo_uscita = float(fields.get("importo uscita", 0))
        
        # Determine if this is a credit or debit entry
        is_credit = importo_entrata > 0
        amount = importo_entrata if is_credit else importo_uscita
        
        if amount == 0:
            raise HTTPException(status_code=400, detail="Transaction must have either a credit or debit amount")
        
        # Get receipt file URL if present
        ricevuta_url = None
        if "ricevuta" in fields and fields["ricevuta"]:
            ricevuta_url = fields["ricevuta"][0]["url"] if isinstance(fields["ricevuta"], list) else None
        
        # Create staged transaction
        staged_data = models.StagedTransactionCreate(
            source_id=source.id,
            transaction_date=date.fromisoformat(fields["data"]),  # Tally sends ISO format dates
            description=f"{fields.get('causale', 'No description')} - {fields.get('mese', '')}".strip(' -'),
            amount=Decimal(str(amount)),
            raw_data=json.dumps({
                **fields,
                "is_credit": is_credit,
                "receipt_url": ricevuta_url,
                "category": fields.get("categoria"),
                "account": fields.get("conto")
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

        # Initialize tokens
        client.generate_token()
        
        # Get transactions from all connected accounts
        staged_transactions = []
        
        # Get list of connected banks
        banks = list_connected_banks(client)
        
        for bank in banks:
            accounts = get_bank_accounts(client, bank['id'])
            for account in accounts:
                transactions = get_bank_transactions(account)
                
                # Convert each transaction to a staged transaction
                for tx in transactions:
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
        
        return {
            "message": f"Successfully synced {len(staged_transactions)} transactions from GoCardless",
            "transactions_count": len(staged_transactions)
        }
        
    except Exception as e:
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
    db: Session = Depends(get_db)
):
    """
    List bank accounts from local database, update if needed.
    """
    try:
        # Get the import source
        source = db.query(models.ImportSource).filter_by(id=source_id).first()
        if not source:
            raise HTTPException(status_code=404, detail="GoCardless import source not found")
        
        # Get the bank connection
        bank_connection = db.query(models.BankConnection).filter_by(
            import_source_id=source_id
        ).first()
        
        if not bank_connection:
            raise HTTPException(status_code=404, detail="Bank connection not found")

        # Initialize Nordigen client
        client = NordigenClient(
            secret_id=source.config.get('secretId'),
            secret_key=source.config.get('secretKey')
        )

        # Get requisition details
        requisition = client.requisition.get_requisition_by_id(
            bank_connection.requisition_id
        )

        # If requisition is complete, update connection status
        if requisition['status'] == 'LN':
            bank_connection.status = 'active'
            db.commit()

        # Get accounts for this requisition
        accounts = []
        for account_id in requisition['accounts']:
            try:
                account = client.account_api(account_id)
                details = account.get_details()
                accounts.append({
                    'id': account_id,
                    'name': details['account'].get('name', 'Unknown Account'),
                    'iban': details['account'].get('iban'),
                    'currency': details['account'].get('currency'),
                    'status': details['status']
                })
            except Exception as e:
                print(f"Error fetching account {account_id}: {str(e)}")
                continue

        return accounts
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

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