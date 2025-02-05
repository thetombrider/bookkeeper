from datetime import date
from decimal import Decimal
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from . import models

class BookkeepingService:
    def __init__(self, db: Session):
        self.db = db

    # Account Categories
    def list_account_categories(self) -> List[models.AccountCategory]:
        """List all account categories."""
        return self.db.query(models.AccountCategory).order_by(models.AccountCategory.name).all()

    def create_account_category(self, category_data: models.AccountCategoryCreate) -> models.AccountCategory:
        """Create a new account category."""
        db_category = models.AccountCategory(**category_data.model_dump())
        self.db.add(db_category)
        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def update_account_category(self, category_id: str, category_data: models.AccountCategoryCreate) -> Optional[models.AccountCategory]:
        """Update an existing account category."""
        db_category = self.db.query(models.AccountCategory).filter(models.AccountCategory.id == category_id).first()
        if not db_category:
            return None
            
        for key, value in category_data.model_dump().items():
            setattr(db_category, key, value)
            
        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def delete_account_category(self, category_id: str) -> bool:
        """Delete an account category. Returns True if successful, False if category not found."""
        db_category = self.db.query(models.AccountCategory).filter(models.AccountCategory.id == category_id).first()
        if not db_category:
            return False
            
        # Check if category has any accounts
        if db_category.accounts:
            raise ValueError("Cannot delete category that has accounts associated with it")
            
        self.db.delete(db_category)
        self.db.commit()
        return True

    # Accounts
    def list_accounts(self, category_id: Optional[str] = None, account_type: Optional[str] = None) -> List[models.Account]:
        """List accounts, optionally filtered by category or type."""
        query = self.db.query(models.Account)
        
        if category_id:
            query = query.filter(models.Account.category_id == category_id)
        if account_type:
            query = query.filter(models.Account.type == account_type)
            
        return query.order_by(models.Account.code).all()

    def get_account(self, account_id: str) -> Optional[models.Account]:
        """Get a specific account by ID."""
        return self.db.query(models.Account).filter(models.Account.id == account_id).first()

    def create_account(self, account_data: models.AccountCreate) -> models.Account:
        """Create a new account."""
        # Verify category exists if provided
        if account_data.category_id:
            category = self.db.query(models.AccountCategory).get(account_data.category_id)
            if not category:
                raise ValueError(f"Account category with id {account_data.category_id} not found")

        db_account = models.Account(**account_data.model_dump())
        self.db.add(db_account)
        self.db.commit()
        self.db.refresh(db_account)
        return db_account

    def update_account(self, account_id: str, account_data: models.AccountCreate) -> Optional[models.Account]:
        """Update an existing account."""
        db_account = self.db.query(models.Account).filter(models.Account.id == account_id).first()
        if not db_account:
            return None
            
        # Verify new category exists if provided
        if account_data.category_id:
            category = self.db.query(models.AccountCategory).get(account_data.category_id)
            if not category:
                raise ValueError(f"Account category with id {account_data.category_id} not found")
            
        for key, value in account_data.model_dump().items():
            setattr(db_account, key, value)
            
        self.db.commit()
        self.db.refresh(db_account)
        return db_account

    def delete_account(self, account_id: str) -> bool:
        """Delete an account. Returns True if successful, False if account not found."""
        db_account = self.db.query(models.Account).filter(models.Account.id == account_id).first()
        if not db_account:
            return False
            
        # Check if account has any journal entries
        if db_account.journal_entries:
            raise ValueError("Cannot delete account that has journal entries associated with it")
            
        self.db.delete(db_account)
        self.db.commit()
        return True

    def get_account_balance(self, account_id: str, as_of: Optional[date] = None) -> Decimal:
        """Calculate the balance for a specific account."""
        query = self.db.query(
            func.sum(models.JournalEntry.debit_amount).label('total_debits'),
            func.sum(models.JournalEntry.credit_amount).label('total_credits')
        ).filter(models.JournalEntry.account_id == account_id)
        
        if as_of:
            query = query.join(models.Transaction)\
                .filter(models.Transaction.transaction_date <= as_of)
        
        result = query.first()
        total_debits = result.total_debits or Decimal('0.00')
        total_credits = result.total_credits or Decimal('0.00')
        
        return total_debits - total_credits

    def get_account_balances(
        self,
        as_of: Optional[date] = None,
        category_id: Optional[str] = None,
        account_type: Optional[str] = None
    ) -> Dict[str, Decimal]:
        """Get balances for all accounts, optionally filtered."""
        # First get the accounts we're interested in
        accounts_query = self.db.query(models.Account)
        if category_id:
            accounts_query = accounts_query.filter(models.Account.category_id == category_id)
        if account_type:
            accounts_query = accounts_query.filter(models.Account.type == account_type)
        
        accounts = accounts_query.all()
        
        # Get balances for these accounts
        balances = {}
        for account in accounts:
            balances[str(account.id)] = self.get_account_balance(account.id, as_of)
            
        return balances

    # Transactions
    def create_transaction(self, transaction_data: models.TransactionCreate) -> models.Transaction:
        """Create a new transaction with journal entries."""
        # Create transaction
        transaction_dict = transaction_data.model_dump(exclude={'entries'})
        db_transaction = models.Transaction(**transaction_dict)
        self.db.add(db_transaction)
        
        # Create journal entries
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')
        
        for entry in transaction_data.entries:
            # Verify account exists
            account = self.db.query(models.Account).get(entry.account_id)
            if not account:
                self.db.rollback()
                raise ValueError(f"Account with id {entry.account_id} not found")

            journal_entry = models.JournalEntry(
                transaction_id=db_transaction.id,
                **entry.model_dump()
            )
            total_debits += entry.debit_amount
            total_credits += entry.credit_amount
            self.db.add(journal_entry)
        
        # Verify double-entry principle
        if total_debits != total_credits:
            self.db.rollback()
            raise ValueError("Total debits must equal total credits")
            
        self.db.commit()
        self.db.refresh(db_transaction)
        return db_transaction

    def update_transaction(self, transaction_id: str, transaction_data: models.TransactionCreate) -> Optional[models.Transaction]:
        """Update an existing transaction."""
        db_transaction = self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
        if not db_transaction:
            return None
            
        # Update transaction details
        for key, value in transaction_data.model_dump(exclude={'entries'}).items():
            setattr(db_transaction, key, value)
            
        # Delete existing journal entries
        for entry in db_transaction.journal_entries:
            self.db.delete(entry)
            
        # Create new journal entries
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')
        
        for entry in transaction_data.entries:
            # Verify account exists
            account = self.db.query(models.Account).get(entry.account_id)
            if not account:
                self.db.rollback()
                raise ValueError(f"Account with id {entry.account_id} not found")

            journal_entry = models.JournalEntry(
                transaction_id=transaction_id,
                **entry.model_dump()
            )
            total_debits += entry.debit_amount
            total_credits += entry.credit_amount
            self.db.add(journal_entry)
        
        # Verify double-entry principle
        if total_debits != total_credits:
            self.db.rollback()
            raise ValueError("Total debits must equal total credits")
            
        self.db.commit()
        self.db.refresh(db_transaction)
        return db_transaction

    def delete_transaction(self, transaction_id: str) -> bool:
        """Delete a transaction and its journal entries. Returns True if successful, False if not found."""
        db_transaction = self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
        if not db_transaction:
            return False
            
        # Delete associated journal entries (should cascade automatically)
        self.db.delete(db_transaction)
        self.db.commit()
        return True

    def get_transaction(self, transaction_id: str) -> Optional[models.Transaction]:
        """Get a specific transaction by ID."""
        return self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()

    def list_transactions(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[models.Transaction]:
        """List all transactions, optionally filtered by date range."""
        query = self.db.query(models.Transaction)
        
        if start_date:
            query = query.filter(models.Transaction.transaction_date >= start_date)
        if end_date:
            query = query.filter(models.Transaction.transaction_date <= end_date)
            
        return query.order_by(models.Transaction.transaction_date.desc()).all()

    # Journal Entries
    def list_journal_entries(
        self,
        account_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[models.JournalEntry]:
        """List journal entries with optional filters."""
        query = self.db.query(models.JournalEntry)\
            .join(models.Transaction)  # Join with transactions for date filtering
        
        if account_id:
            query = query.filter(models.JournalEntry.account_id == account_id)
        
        if start_date:
            query = query.filter(models.Transaction.transaction_date >= start_date)
        if end_date:
            query = query.filter(models.Transaction.transaction_date <= end_date)
            
        return query.order_by(models.Transaction.transaction_date.desc()).all()

    def update_journal_entry(self, entry_id: str, entry_data: models.JournalEntryCreate) -> Optional[models.JournalEntry]:
        """Update an existing journal entry."""
        db_entry = self.db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
        if not db_entry:
            return None
            
        # Verify account exists
        account = self.db.query(models.Account).get(entry_data.account_id)
        if not account:
            raise ValueError(f"Account with id {entry_data.account_id} not found")
            
        # Update entry
        for key, value in entry_data.model_dump().items():
            setattr(db_entry, key, value)
            
        # Verify double-entry principle for the entire transaction
        transaction = db_entry.transaction
        total_debits = sum(e.debit_amount for e in transaction.journal_entries if e.id != entry_id)
        total_credits = sum(e.credit_amount for e in transaction.journal_entries if e.id != entry_id)
        total_debits += entry_data.debit_amount
        total_credits += entry_data.credit_amount
        
        if total_debits != total_credits:
            self.db.rollback()
            raise ValueError("Total debits must equal total credits for the transaction")
            
        self.db.commit()
        self.db.refresh(db_entry)
        return db_entry

    def delete_journal_entry(self, entry_id: str) -> bool:
        """Delete a journal entry. Returns True if successful, False if not found."""
        db_entry = self.db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
        if not db_entry:
            return False
            
        # Check if this would break double-entry principle
        transaction = db_entry.transaction
        if len(transaction.journal_entries) <= 2:
            raise ValueError("Cannot delete journal entry as it would leave transaction with less than two entries")
            
        total_debits = sum(e.debit_amount for e in transaction.journal_entries if e.id != entry_id)
        total_credits = sum(e.credit_amount for e in transaction.journal_entries if e.id != entry_id)
        
        if total_debits != total_credits:
            raise ValueError("Deleting this entry would break the double-entry principle")
            
        self.db.delete(db_entry)
        self.db.commit()
        return True

    # Reports
    def get_balance_sheet(self, as_of: Optional[date] = None) -> models.BalanceSheet:
        """Generate a balance sheet as of a specific date."""
        if as_of is None:
            as_of = date.today()

        # Get all account balances
        balances = self.get_account_balances(as_of=as_of)
        
        # Organize by account type
        assets = []
        liabilities = []
        equity = []
        total_assets = Decimal('0.00')
        total_liabilities = Decimal('0.00')
        total_equity = Decimal('0.00')

        for account_id, balance in balances.items():
            account = self.get_account(account_id)
            if not account:
                continue

            balance_data = {
                "account_id": str(account.id),
                "name": account.name,
                "balance": balance
            }

            if account.type == models.AccountType.ASSET:
                assets.append(balance_data)
                total_assets += balance
            elif account.type == models.AccountType.LIABILITY:
                liabilities.append(balance_data)
                total_liabilities += balance
            elif account.type == models.AccountType.EQUITY:
                equity.append(balance_data)
                total_equity += balance

        return models.BalanceSheet(
            assets=assets,
            liabilities=liabilities,
            equity=equity,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity
        )

    def get_income_statement(self, start_date: date, end_date: date) -> models.IncomeStatement:
        """Generate an income statement for a specific period."""
        # Get balances for income and expense accounts
        income_balances = self.get_account_balances(
            as_of=end_date,
            account_type=models.AccountType.INCOME
        )
        expense_balances = self.get_account_balances(
            as_of=end_date,
            account_type=models.AccountType.EXPENSE
        )
        
        income = []
        expenses = []
        total_income = Decimal('0.00')
        total_expenses = Decimal('0.00')

        # Process income accounts
        for account_id, balance in income_balances.items():
            account = self.get_account(account_id)
            if not account:
                continue
            income.append({
                "account_id": str(account.id),
                "name": account.name,
                "balance": abs(balance)
            })
            total_income += abs(balance)

        # Process expense accounts
        for account_id, balance in expense_balances.items():
            account = self.get_account(account_id)
            if not account:
                continue
            expenses.append({
                "account_id": str(account.id),
                "name": account.name,
                "balance": abs(balance)
            })
            total_expenses += abs(balance)

        return models.IncomeStatement(
            income=income,
            expenses=expenses,
            total_income=total_income,
            total_expenses=total_expenses,
            net_income=total_income - total_expenses
        ) 