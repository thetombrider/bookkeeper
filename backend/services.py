"""
BookkeepingService Class

This module implements the core business logic for the bookkeeping application.
It handles all database operations and business rules for:
- Account Categories
- Accounts
- Transactions
- Journal Entries
- Financial Reports
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional, Dict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from . import models

class BookkeepingService:
    """
    Core service class that implements all business logic for the bookkeeping application.
    Handles database operations and enforces business rules for double-entry bookkeeping.
    """
    
    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db

    # Account Categories
    def list_account_categories(self) -> List[models.AccountCategory]:
        """
        List all account categories ordered by name.
        
        Returns:
            List[AccountCategory]: List of all account categories in the system
        """
        return self.db.query(models.AccountCategory).order_by(models.AccountCategory.name).all()

    def create_account_category(self, category_data: models.AccountCategoryCreate) -> models.AccountCategory:
        """
        Create a new account category.
        
        Args:
            category_data: Data for the new category including name and optional description
            
        Returns:
            AccountCategory: The newly created account category
            
        Raises:
            SQLAlchemyError: If there's a database error
        """
        db_category = models.AccountCategory(**category_data.model_dump())
        self.db.add(db_category)
        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def update_account_category(self, category_id: str, category_data: models.AccountCategoryCreate) -> Optional[models.AccountCategory]:
        """
        Update an existing account category.
        
        Args:
            category_id: ID of the category to update
            category_data: New data for the category
            
        Returns:
            Optional[AccountCategory]: Updated category or None if not found
        """
        db_category = self.db.query(models.AccountCategory).filter(models.AccountCategory.id == category_id).first()
        if not db_category:
            return None
            
        for key, value in category_data.model_dump().items():
            setattr(db_category, key, value)
            
        self.db.commit()
        self.db.refresh(db_category)
        return db_category

    def delete_account_category(self, category_id: str) -> bool:
        """
        Delete an account category if it has no associated accounts.
        
        Args:
            category_id: ID of the category to delete
            
        Returns:
            bool: True if deleted successfully, False if not found
            
        Raises:
            ValueError: If category has associated accounts
        """
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
        """
        List accounts with optional filtering.
        
        Args:
            category_id: Optional category ID to filter by
            account_type: Optional account type to filter by
            
        Returns:
            List[Account]: List of accounts matching the criteria
        """
        query = self.db.query(models.Account).options(
            joinedload(models.Account.category)
        )
        
        if category_id:
            query = query.filter(models.Account.category_id == category_id)
        if account_type:
            query = query.filter(models.Account.type == account_type)
            
        return query.order_by(models.Account.code).all()

    def get_account(self, account_id: str) -> Optional[models.Account]:
        """
        Get a specific account by ID.
        
        Args:
            account_id: ID of the account to retrieve
            
        Returns:
            Optional[Account]: The account if found, None otherwise
        """
        return self.db.query(models.Account).filter(models.Account.id == account_id).first()

    def create_account(self, account_data: models.AccountCreate) -> models.Account:
        """
        Create a new account in the chart of accounts.
        
        Args:
            account_data: Data for the new account
            
        Returns:
            Account: The newly created account
            
        Raises:
            ValueError: If the specified category doesn't exist
        """
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
        """
        Update an existing account.
        
        Args:
            account_id: ID of the account to update
            account_data: New data for the account
            
        Returns:
            Optional[Account]: Updated account or None if not found
            
        Raises:
            ValueError: If the specified category doesn't exist
        """
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
        """
        Delete an account if it has no associated journal entries.
        
        Args:
            account_id: ID of the account to delete
            
        Returns:
            bool: True if deleted successfully, False if not found
            
        Raises:
            ValueError: If account has associated journal entries
        """
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
        """
        Calculate the current balance for a specific account.
        
        Args:
            account_id: ID of the account to calculate balance for
            as_of: Optional date to calculate historical balance
            
        Returns:
            Decimal: The account balance (positive for debit balance, negative for credit balance)
        """
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
        """
        Get balances for multiple accounts with optional filtering.
        
        Args:
            as_of: Optional date for historical balances
            category_id: Optional category ID to filter accounts
            account_type: Optional account type to filter accounts
            
        Returns:
            Dict[str, Decimal]: Dictionary mapping account IDs to their balances
        """
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
        """
        Create a new transaction with associated journal entries.
        
        Args:
            transaction_data: Transaction data including journal entries
            
        Returns:
            Transaction: The newly created transaction
            
        Raises:
            ValueError: If accounts don't exist or debits don't equal credits
        """
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
        """
        Update an existing transaction and its journal entries.
        
        Args:
            transaction_id: ID of the transaction to update
            transaction_data: New transaction data including journal entries
            
        Returns:
            Optional[Transaction]: Updated transaction or None if not found
            
        Raises:
            ValueError: If accounts don't exist or debits don't equal credits
        """
        db_transaction = self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
        if not db_transaction:
            return None
            
        # Update transaction fields
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
        """
        Delete a transaction and all its journal entries.
        
        Args:
            transaction_id: ID of the transaction to delete
            
        Returns:
            bool: True if deleted successfully, False if not found
        """
        db_transaction = self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
        if not db_transaction:
            return False
            
        # Delete associated journal entries (should cascade automatically)
        self.db.delete(db_transaction)
        self.db.commit()
        return True

    def get_transaction(self, transaction_id: str) -> Optional[models.Transaction]:
        """
        Get a specific transaction by ID.
        
        Args:
            transaction_id: ID of the transaction to retrieve
            
        Returns:
            Optional[Transaction]: The transaction if found, None otherwise
        """
        return self.db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()

    def list_transactions(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[models.Transaction]:
        """
        List all transactions with optional date filtering.
        
        Args:
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            List[Transaction]: List of transactions matching the criteria
        """
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
        """
        List journal entries with optional filtering.
        
        Args:
            account_id: Optional account ID to filter by
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            List[JournalEntry]: List of journal entries matching the criteria
        """
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
        """
        Update an existing journal entry.
        
        Args:
            entry_id: ID of the journal entry to update
            entry_data: New journal entry data
            
        Returns:
            Optional[JournalEntry]: Updated journal entry or None if not found
            
        Raises:
            ValueError: If the specified account doesn't exist
        """
        db_entry = self.db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
        if not db_entry:
            return None
            
        # Verify account exists
        account = self.db.query(models.Account).get(entry_data.account_id)
        if not account:
            raise ValueError(f"Account with id {entry_data.account_id} not found")
            
        for key, value in entry_data.model_dump().items():
            setattr(db_entry, key, value)
            
        self.db.commit()
        self.db.refresh(db_entry)
        return db_entry

    def delete_journal_entry(self, entry_id: str) -> bool:
        """
        Delete a journal entry.
        
        Args:
            entry_id: ID of the journal entry to delete
            
        Returns:
            bool: True if deleted successfully, False if not found
            
        Raises:
            ValueError: If deleting the entry would unbalance the transaction
        """
        db_entry = self.db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
        if not db_entry:
            return False
            
        # Check if this would unbalance the transaction
        transaction = db_entry.transaction
        total_debits = sum(e.debit_amount for e in transaction.journal_entries if e.id != entry_id)
        total_credits = sum(e.credit_amount for e in transaction.journal_entries if e.id != entry_id)
        
        if total_debits != total_credits:
            raise ValueError("Cannot delete journal entry as it would unbalance the transaction")
            
        self.db.delete(db_entry)
        self.db.commit()
        return True

    # Financial Reports
    def get_balance_sheet(self, as_of: Optional[date] = None) -> models.BalanceSheet:
        """
        Generate a balance sheet report.
        
        Args:
            as_of: Optional date for point-in-time balance sheet
            
        Returns:
            BalanceSheet: Balance sheet report containing:
            - List of assets with balances
            - List of liabilities with balances
            - List of equity accounts with balances
            - Total assets
            - Total liabilities
            - Total equity
        """
        # Get all accounts grouped by type
        assets = self.db.query(models.Account).filter(models.Account.type == models.AccountType.ASSET).all()
        liabilities = self.db.query(models.Account).filter(models.Account.type == models.AccountType.LIABILITY).all()
        equity = self.db.query(models.Account).filter(models.Account.type == models.AccountType.EQUITY).all()
        
        # Calculate balances
        asset_details = []
        total_assets = Decimal('0.00')
        for account in assets:
            balance = self.get_account_balance(account.id, as_of)
            if balance != 0:
                asset_details.append({
                    'name': account.name,
                    'balance': balance
                })
                total_assets += balance
                
        liability_details = []
        total_liabilities = Decimal('0.00')
        for account in liabilities:
            balance = self.get_account_balance(account.id, as_of)
            if balance != 0:
                liability_details.append({
                    'name': account.name,
                    'balance': -balance  # Liabilities are normally credit balances
                })
                total_liabilities += -balance
                
        equity_details = []
        total_equity = Decimal('0.00')
        for account in equity:
            balance = self.get_account_balance(account.id, as_of)
            if balance != 0:
                equity_details.append({
                    'name': account.name,
                    'balance': -balance  # Equity accounts are normally credit balances
                })
                total_equity += -balance
                
        return models.BalanceSheet(
            assets=asset_details,
            liabilities=liability_details,
            equity=equity_details,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity
        )
        
    def get_income_statement(self, start_date: date, end_date: date) -> models.IncomeStatement:
        """
        Generate an income statement report for a specific period.
        
        Args:
            start_date: Beginning of the reporting period
            end_date: End of the reporting period
            
        Returns:
            IncomeStatement: Income statement report containing:
            - List of income accounts with balances
            - List of expense accounts with balances
            - Total income
            - Total expenses
            - Net income
        """
        # Get all income and expense accounts
        income_accounts = self.db.query(models.Account).filter(models.Account.type == models.AccountType.INCOME).all()
        expense_accounts = self.db.query(models.Account).filter(models.Account.type == models.AccountType.EXPENSE).all()
        
        # Calculate income totals
        income_details = []
        total_income = Decimal('0.00')
        for account in income_accounts:
            # Get the change in balance over the period
            start_balance = self.get_account_balance(account.id, start_date)
            end_balance = self.get_account_balance(account.id, end_date)
            period_activity = end_balance - start_balance
            
            if period_activity != 0:
                income_details.append({
                    'name': account.name,
                    'balance': -period_activity  # Income accounts are normally credit balances
                })
                total_income += -period_activity
                
        # Calculate expense totals
        expense_details = []
        total_expenses = Decimal('0.00')
        for account in expense_accounts:
            # Get the change in balance over the period
            start_balance = self.get_account_balance(account.id, start_date)
            end_balance = self.get_account_balance(account.id, end_date)
            period_activity = end_balance - start_balance
            
            if period_activity != 0:
                expense_details.append({
                    'name': account.name,
                    'balance': period_activity  # Expense accounts are normally debit balances
                })
                total_expenses += period_activity
                
        return models.IncomeStatement(
            income=income_details,
            expenses=expense_details,
            total_income=total_income,
            total_expenses=total_expenses,
            net_income=total_income - total_expenses
        ) 