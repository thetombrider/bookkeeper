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
from typing import List, Optional, Dict, Tuple, Any
from sqlalchemy.orm import Session, joinedload, subqueryload, contains_eager
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
        # Convert Pydantic model to dict and create SQLAlchemy model
        category_dict = category_data.model_dump()
        db_category = models.AccountCategory(**category_dict)
        
        try:
            self.db.add(db_category)
            self.db.commit()
            self.db.refresh(db_category)
            return db_category
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error creating category: {str(e)}")

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
            bool: True if deleted successfully
            
        Raises:
            ValueError: If category has associated accounts, including details about the accounts
            HTTPException: If category is not found
        """
        db_category = self.db.query(models.AccountCategory).filter(models.AccountCategory.id == category_id).first()
        if not db_category:
            raise ValueError(f"Account category with id {category_id} not found")
            
        # Check if category has any accounts and get their details
        if db_category.accounts:
            account_names = [f"'{account.name}' ({account.code})" for account in db_category.accounts]
            accounts_list = ", ".join(account_names)
            raise ValueError(
                f"Cannot delete category '{db_category.name}' because it has {len(db_category.accounts)} "
                f"associated accounts: {accounts_list}. Please reassign or delete these accounts first."
            )
            
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

    def _generate_account_code(self, account_type: models.AccountType) -> str:
        """
        Generate the next available account code for the given account type.
        Format: X-NNN where X is the type prefix and NNN is a progressive number.
        
        Args:
            account_type: The type of account (asset, liability, equity, income, expense)
            
        Returns:
            str: The next available account code
        """
        # Define prefix mapping
        type_prefix = {
            models.AccountType.ASSET: 'A',
            models.AccountType.LIABILITY: 'L',
            models.AccountType.EQUITY: 'E',
            models.AccountType.INCOME: 'R',  # R for Revenue
            models.AccountType.EXPENSE: 'X'
        }
        
        prefix = type_prefix[account_type]
        
        # Get the highest number for this prefix
        latest_account = self.db.query(models.Account)\
            .filter(models.Account.code.like(f'{prefix}-%'))\
            .order_by(models.Account.code.desc())\
            .first()
            
        if not latest_account:
            # No accounts of this type exist yet
            next_number = 1
        else:
            try:
                # Extract the number from the latest code
                current_number = int(latest_account.code.split('-')[1])
                next_number = current_number + 1
            except (IndexError, ValueError):
                # If there's any error parsing the existing code, start from 1
                next_number = 1
                
        # Format the new code with leading zeros
        return f"{prefix}-{next_number:03d}"

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

        # Generate the account code
        account_dict = account_data.model_dump()
        account_dict['code'] = self._generate_account_code(account_data.type)

        db_account = models.Account(**account_dict)
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
            ValueError: If the specified category doesn't exist or if trying to change account type
        """
        db_account = self.db.query(models.Account).filter(models.Account.id == account_id).first()
        if not db_account:
            return None
            
        # Verify new category exists if provided
        if account_data.category_id:
            category = self.db.query(models.AccountCategory).get(account_data.category_id)
            if not category:
                raise ValueError(f"Account category with id {account_data.category_id} not found")
        
        # Don't allow changing account type as it would invalidate the code
        if account_data.type != db_account.type:
            raise ValueError(f"Cannot change account type from {db_account.type} to {account_data.type} as it would invalidate the account code")
            
        # Update allowed fields
        account_dict = account_data.model_dump(exclude={'type'})  # Exclude type from update
        for key, value in account_dict.items():
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
    def _generate_transaction_reference(self) -> str:
        """
        Generate the next available transaction reference number.
        Format: TXN-YYYYMMDD-NNN where NNN is a sequential number
        """
        from datetime import datetime
        
        # Get current date
        current_date = datetime.now()
        date_str = current_date.strftime('%Y%m%d')
        prefix = f'TXN-{date_str}-'
        
        # Get the highest number for this day
        latest_transaction = self.db.query(models.Transaction)\
            .filter(models.Transaction.reference_number.like(f'{prefix}%'))\
            .order_by(models.Transaction.reference_number.desc())\
            .first()
            
        if not latest_transaction or not latest_transaction.reference_number:
            # No transactions today yet
            next_number = 1
        else:
            try:
                # Extract the number from the latest reference
                current_number = int(latest_transaction.reference_number.split('-')[2])
                next_number = current_number + 1
            except (IndexError, ValueError):
                # If there's any error parsing the existing reference, start from 1
                next_number = 1
                
        # Format the new reference with leading zeros
        return f"{prefix}{next_number:03d}"

    def create_transaction(self, transaction_data: models.TransactionCreate) -> models.Transaction:
        """Create a new transaction with its journal entries."""
        try:
            # Start a nested transaction for atomicity
            with self.db.begin_nested():
                # Basic validation
                if not hasattr(transaction_data, 'entries') or not transaction_data.entries:
                    raise ValueError("No journal entries provided")
                
                if not isinstance(transaction_data.entries, list):
                    raise ValueError("Journal entries must be a list")

                if not transaction_data.description:
                    raise ValueError("Transaction description is required")

                if not transaction_data.transaction_date:
                    raise ValueError("Transaction date is required")

                # Track valid entries and used accounts
                valid_entries = []
                used_accounts = set()
                total_debits = Decimal('0')
                total_credits = Decimal('0')

                # Process and validate each entry
                for entry in transaction_data.entries:
                    # Skip empty entries
                    if not entry.account_id or (not entry.debit_amount and not entry.credit_amount):
                        continue

                    # Validate account exists
                    account = self.db.query(models.Account).get(entry.account_id)
                    if not account:
                        raise ValueError(f"Account {entry.account_id} not found")

                    # Check for duplicate account usage
                    if entry.account_id in used_accounts:
                        raise ValueError(f"Account {account.name} is used multiple times")
                    used_accounts.add(entry.account_id)

                    # Convert amounts to Decimal for precise calculation
                    debit = Decimal(str(entry.debit_amount)) if entry.debit_amount else Decimal('0')
                    credit = Decimal(str(entry.credit_amount)) if entry.credit_amount else Decimal('0')

                    # Validate amounts
                    if debit < 0 or credit < 0:
                        raise ValueError("Negative amounts are not allowed")
                    if debit > 0 and credit > 0:
                        raise ValueError(f"Account {account.name} cannot be both debited and credited")

                    # Add to totals
                    total_debits += debit
                    total_credits += credit

                    # Add to valid entries
                    valid_entries.append({
                        'account_id': entry.account_id,
                        'debit_amount': debit,
                        'credit_amount': credit
                    })

                # Final validations
                if len(valid_entries) < 2:
                    raise ValueError("At least two valid journal entries are required")

                if abs(total_debits - total_credits) >= Decimal('0.01'):
                    raise ValueError("Total debits must equal total credits")

                # Create the transaction
                transaction = models.Transaction(
                    reference_number=self._generate_transaction_reference(),
                    transaction_date=transaction_data.transaction_date,
                    description=transaction_data.description
                )
                self.db.add(transaction)
                self.db.flush()  # Get the transaction ID

                # Create journal entries
                for entry_data in valid_entries:
                    entry = models.JournalEntry(
                        transaction_id=transaction.id,
                        **entry_data
                    )
                    self.db.add(entry)

            # If we get here, commit the outer transaction
            self.db.commit()
            return transaction

        except Exception as e:
            self.db.rollback()
            raise ValueError(str(e))

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
        """Delete a transaction and its associated journal entries."""
        try:
            # Start a nested transaction
            with self.db.begin_nested():
                # Get and lock the transaction
                transaction = self.db.query(models.Transaction)\
                    .filter(models.Transaction.id == transaction_id)\
                    .with_for_update()\
                    .first()

                if not transaction:
                    return False

                # Delete all associated journal entries first
                self.db.query(models.JournalEntry)\
                    .filter(models.JournalEntry.transaction_id == transaction_id)\
                    .delete(synchronize_session=False)

                # Delete the transaction
                self.db.delete(transaction)
            
            # If we get here, commit the outer transaction
            self.db.commit()
            return True
            
        except Exception as e:
            # Rollback in case of any error
            self.db.rollback()
            raise ValueError(f"Error deleting transaction: {str(e)}")

    def get_transaction(self, transaction_id: str) -> Optional[models.Transaction]:
        """
        Get a specific transaction by ID with all related data.
        
        Args:
            transaction_id: ID of the transaction to retrieve
            
        Returns:
            Optional[Transaction]: The transaction if found, None otherwise
        """
        print(f"DEBUG: Fetching transaction with ID: {transaction_id}")
        
        # Get the transaction with all related data in a single query
        transaction = self.db.query(models.Transaction)\
            .options(
                joinedload(models.Transaction.journal_entries)
                .joinedload(models.JournalEntry.account)
            )\
            .filter(models.Transaction.id == transaction_id)\
            .first()
            
        if not transaction:
            print("DEBUG: Transaction not found")
            return None
            
        print(f"DEBUG: Found transaction: {transaction.id}, {transaction.description}")
        
        # Verify all entries have their accounts loaded
        for entry in transaction.journal_entries:
            print(f"DEBUG: Checking entry {entry.id}")
            if not entry.account:
                print(f"DEBUG: Account missing for entry {entry.id}, attempting to load")
                entry.account = self.db.query(models.Account)\
                    .filter(models.Account.id == entry.account_id)\
                    .first()
                if entry.account:
                    print(f"DEBUG: Successfully loaded account {entry.account.code} - {entry.account.name}")
                else:
                    print(f"DEBUG: WARNING - Could not load account {entry.account_id}")
            else:
                print(f"DEBUG: Account already loaded: {entry.account.code} - {entry.account.name}")
                
        return transaction

    def list_transactions(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        account_id: Optional[str] = None,
        account_filter_type: Optional[str] = None
    ) -> List[models.Transaction]:
        """
        List all transactions with optional filtering.
        
        Args:
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            account_id: Optional account ID to filter by
            account_filter_type: Type of account filter ('any' to match either debit or credit)
            
        Returns:
            List[Transaction]: List of transactions matching the criteria
        """
        # Get all transactions with journal entries and accounts in a single query
        query = self.db.query(models.Transaction)\
            .join(models.Transaction.journal_entries)\
            .join(models.Account)\
            .options(
                contains_eager(models.Transaction.journal_entries)
                .contains_eager(models.JournalEntry.account)
            )
        
        if start_date:
            query = query.filter(models.Transaction.transaction_date >= start_date)
        if end_date:
            query = query.filter(models.Transaction.transaction_date <= end_date)
            
        # Add account filtering
        if account_id:
            # Filter transactions where the account appears in either debit or credit entries
            if account_filter_type == 'any':
                query = query.filter(
                    models.Transaction.id.in_(
                        self.db.query(models.JournalEntry.transaction_id)
                        .filter(models.JournalEntry.account_id == account_id)
                    )
                )
            
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
        """
        # Get all accounts grouped by type
        assets = self.db.query(models.Account).filter(models.Account.type == models.AccountType.ASSET).all()
        liabilities = self.db.query(models.Account).filter(models.Account.type == models.AccountType.LIABILITY).all()
        equity = self.db.query(models.Account).filter(models.Account.type == models.AccountType.EQUITY).all()
        income_accounts = self.db.query(models.Account).filter(models.Account.type == models.AccountType.INCOME).all()
        expense_accounts = self.db.query(models.Account).filter(models.Account.type == models.AccountType.EXPENSE).all()
        
        # Calculate balances
        asset_details = []
        total_assets = Decimal('0.00')
        for account in assets:
            balance = self.get_account_balance(account.id, as_of)
            asset_details.append({
                'name': account.name,
                'balance': abs(balance)  # Assets have debit balances (positive)
            })
            total_assets += balance
                
        liability_details = []
        total_liabilities = Decimal('0.00')
        for account in liabilities:
            balance = self.get_account_balance(account.id, as_of)
            liability_details.append({
                'name': account.name,
                'balance': abs(balance)  # Liabilities have credit balances (negative)
            })
            total_liabilities += -balance  # Convert to positive for display
                
        equity_details = []
        total_equity = Decimal('0.00')
        for account in equity:
            balance = self.get_account_balance(account.id, as_of)
            equity_details.append({
                'name': account.name,
                'balance': abs(balance)  # Equity accounts have credit balances (negative)
            })
            total_equity += -balance  # Convert to positive for display

        # Calculate net income
        total_income = Decimal('0.00')
        for account in income_accounts:
            balance = self.get_account_balance(account.id, as_of)
            total_income += -balance  # Income accounts have credit balances (negative)

        total_expenses = Decimal('0.00')
        for account in expense_accounts:
            balance = self.get_account_balance(account.id, as_of)
            total_expenses += balance  # Expense accounts have debit balances (positive)

        net_income = total_income - total_expenses

        # Add net income to equity section if it's not zero
        if net_income != 0:
            equity_details.append({
                'name': 'Utili di esercizio',
                'balance': abs(net_income)
            })
            total_equity += net_income

        # Calculate total liabilities and equity
        total_liabilities_and_equity = total_liabilities + total_equity
                
        return models.BalanceSheet(
            assets=asset_details,
            liabilities=liability_details,
            equity=equity_details,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity,
            net_income=net_income,
            total_liabilities_and_equity=total_liabilities_and_equity
        )
        
    def get_income_statement(self, start_date: date, end_date: date, log_file=None) -> models.IncomeStatement:
        """Generate income statement with optional logging to file."""
        
        def log(message: str):
            """Helper to log messages to both console and file if provided"""
            print(message)  # Keep console logging
            if log_file:
                log_file.write(message + "\n")
        
        log(f"Generating income statement from {start_date} to {end_date}")
        
        with self.db as session:
            # Get all income and expense accounts
            income_accounts = session.query(models.Account).filter(models.Account.type == models.AccountType.INCOME).all()
            expense_accounts = session.query(models.Account).filter(models.Account.type == models.AccountType.EXPENSE).all()

            # Debug print account details
            log("\nIncome Accounts:")
            for acc in income_accounts:
                log(f"ID: {acc.id}, Name: {acc.name}, Type: {acc.type}")

            log("\nExpense Accounts:")
            for acc in expense_accounts:
                log(f"ID: {acc.id}, Name: {acc.name}, Type: {acc.type}")

            # Get all journal entries for income and expense accounts in the date range
            all_entries = session.query(
                models.JournalEntry, models.Account
            ).join(
                models.Transaction,
                models.JournalEntry.transaction_id == models.Transaction.id
            ).join(
                models.Account,
                models.JournalEntry.account_id == models.Account.id
            ).filter(
                models.Transaction.transaction_date >= start_date,
                models.Transaction.transaction_date <= end_date,
                models.Account.type.in_([models.AccountType.INCOME, models.AccountType.EXPENSE])
            ).all()

            log(f"\nFound {len(all_entries)} total journal entries in date range")
            log("Sample of journal entries with account details:")
            for entry, account in all_entries[:5]:
                log(f"Account: {account.name} (ID: {account.id}, Type: {account.type})")
                log(f"Entry: Debit={entry.debit_amount}, Credit={entry.credit_amount}")

            # Process income accounts
            income = []
            total_income = Decimal('0.00')
            
            for account in income_accounts:
                log(f"\nProcessing income account: {account.name} (ID: {account.id})")
                
                # Get all entries for this account in the date range
                account_entries = session.query(models.JournalEntry).join(
                    models.Transaction,
                    models.JournalEntry.transaction_id == models.Transaction.id
                ).filter(
                    models.JournalEntry.account_id == account.id,
                    models.Transaction.transaction_date >= start_date,
                    models.Transaction.transaction_date <= end_date
                ).all()
                
                log(f"Found {len(account_entries)} entries for {account.name}")
                
                # Calculate totals
                total_debits = sum((entry.debit_amount for entry in account_entries), Decimal('0.00'))
                total_credits = sum((entry.credit_amount for entry in account_entries), Decimal('0.00'))
                
                log(f"Account {account.name}: debits={total_debits}, credits={total_credits}")
                
                # For income accounts, credits increase the balance (normal balance is credit)
                balance = total_credits - total_debits
                
                if balance != 0:
                    income.append({
                        'name': account.name,
                        'balance': balance
                    })
                    total_income += balance
            
            log(f"\nTotal income: {total_income}")
            
            # Process expense accounts
            expenses = []
            total_expenses = Decimal('0.00')
            
            for account in expense_accounts:
                log(f"\nProcessing expense account: {account.name} (ID: {account.id})")
                
                # Get all entries for this account in the date range
                account_entries = session.query(models.JournalEntry).join(
                    models.Transaction,
                    models.JournalEntry.transaction_id == models.Transaction.id
                ).filter(
                    models.JournalEntry.account_id == account.id,
                    models.Transaction.transaction_date >= start_date,
                    models.Transaction.transaction_date <= end_date
                ).all()
                
                log(f"Found {len(account_entries)} entries for {account.name}")
                
                # Calculate totals
                total_debits = sum((entry.debit_amount for entry in account_entries), Decimal('0.00'))
                total_credits = sum((entry.credit_amount for entry in account_entries), Decimal('0.00'))
                
                log(f"Account {account.name}: debits={total_debits}, credits={total_credits}")
                
                # For expense accounts, debits increase the balance (normal balance is debit)
                balance = total_debits - total_credits
                
                if balance != 0:
                    expenses.append({
                        'name': account.name,
                        'balance': balance
                    })
                    total_expenses += balance
            
            log(f"\nTotal expenses: {total_expenses}")
            net_income = total_income - total_expenses
            log(f"Net income: {net_income}")
            
            return models.IncomeStatement(
                income=income,
                expenses=expenses,
                total_income=total_income,
                total_expenses=total_expenses,
                net_income=net_income
            )

    # Import Sources
    def create_import_source(self, source_data: models.ImportSourceCreate) -> models.ImportSource:
        """Create a new import source configuration."""
        source_dict = source_data.model_dump()
        db_source = models.ImportSource(**source_dict)
        
        try:
            self.db.add(db_source)
            self.db.commit()
            self.db.refresh(db_source)
            return db_source
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error creating import source: {str(e)}")

    def list_import_sources(self, active_only: bool = True) -> List[models.ImportSource]:
        """List all import sources, optionally filtering for active ones only."""
        query = self.db.query(models.ImportSource)
        if active_only:
            query = query.filter(models.ImportSource.is_active == True)
        return query.order_by(models.ImportSource.name).all()

    def get_import_source(self, source_id: str) -> Optional[models.ImportSource]:
        """Get a specific import source by ID."""
        return self.db.query(models.ImportSource).filter(models.ImportSource.id == source_id).first()

    def update_import_source(self, source_id: str, source_data: models.ImportSourceCreate) -> Optional[models.ImportSource]:
        """Update an existing import source."""
        db_source = self.get_import_source(source_id)
        if not db_source:
            return None

        source_dict = source_data.model_dump(exclude_unset=True)
        for key, value in source_dict.items():
            setattr(db_source, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_source)
            return db_source
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error updating import source: {str(e)}")

    def delete_import_source(self, source_id: str) -> bool:
        """Delete an import source and all its related data."""
        db_source = self.get_import_source(source_id)
        if not db_source:
            return False

        try:
            self.db.delete(db_source)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error deleting import source: {str(e)}")

    # Staged Transactions
    def create_staged_transaction(self, transaction_data: models.StagedTransactionCreate) -> models.StagedTransaction:
        """Create a new staged transaction."""
        transaction_dict = transaction_data.model_dump()
        db_transaction = models.StagedTransaction(**transaction_dict)
        
        try:
            self.db.add(db_transaction)
            self.db.commit()
            self.db.refresh(db_transaction)
            return db_transaction
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error creating staged transaction: {str(e)}")

    def list_staged_transactions(
        self,
        source_id: Optional[str] = None,
        status: Optional[models.ImportStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[models.StagedTransaction]:
        """List staged transactions with optional filtering."""
        query = self.db.query(models.StagedTransaction)
        
        if source_id:
            query = query.filter(models.StagedTransaction.source_id == source_id)
        if status:
            query = query.filter(models.StagedTransaction.status == status)
        if start_date:
            query = query.filter(models.StagedTransaction.transaction_date >= start_date)
        if end_date:
            query = query.filter(models.StagedTransaction.transaction_date <= end_date)
            
        return query.order_by(models.StagedTransaction.transaction_date.desc()).all()

    def process_staged_transaction(self, staged_id: str, counterpart_account_id: str) -> models.Transaction:
        """
        Process a staged transaction by creating a proper double-entry transaction.
        
        Args:
            staged_id: ID of the staged transaction to process
            counterpart_account_id: ID of the account to use as the counterpart
            
        Returns:
            The created transaction
            
        Raises:
            ValueError: If the staged transaction doesn't exist or is invalid
        """
        staged = self.db.query(models.StagedTransaction).get(staged_id)
        if not staged:
            raise ValueError("Staged transaction not found")
            
        if not staged.account_id:
            raise ValueError("Staged transaction has no primary account assigned")
            
        if staged.status == models.ImportStatus.PROCESSED:
            raise ValueError("Transaction has already been processed")
            
        try:
            # Create the transaction
            transaction_data = models.TransactionCreate(
                transaction_date=staged.transaction_date,
                description=staged.description,
                entries=[
                    # Primary entry
                    models.JournalEntryCreate(
                        account_id=staged.account_id,
                        debit_amount=staged.amount if staged.amount > 0 else Decimal('0'),
                        credit_amount=abs(staged.amount) if staged.amount < 0 else Decimal('0')
                    ),
                    # Counterpart entry
                    models.JournalEntryCreate(
                        account_id=counterpart_account_id,
                        debit_amount=abs(staged.amount) if staged.amount < 0 else Decimal('0'),
                        credit_amount=staged.amount if staged.amount > 0 else Decimal('0')
                    )
                ]
            )
            
            # Create the actual transaction
            transaction = self.create_transaction(transaction_data)
            
            # Update staged transaction
            staged.status = models.ImportStatus.PROCESSED
            staged.processed_at = func.now()
            self.db.commit()
            
            return transaction
            
        except Exception as e:
            self.db.rollback()
            staged.status = models.ImportStatus.ERROR
            staged.error_message = str(e)
            self.db.commit()
            raise ValueError(f"Error processing staged transaction: {str(e)}")

    def bulk_process_staged_transactions(
        self,
        staged_ids: List[str],
        counterpart_account_id: str
    ) -> Tuple[List[models.Transaction], List[Dict[str, Any]]]:
        """
        Process multiple staged transactions at once.
        
        Returns:
            Tuple containing:
            - List of successfully created transactions
            - List of errors for failed transactions
        """
        successful = []
        errors = []
        
        for staged_id in staged_ids:
            try:
                transaction = self.process_staged_transaction(staged_id, counterpart_account_id)
                successful.append(transaction)
            except Exception as e:
                errors.append({
                    'staged_id': staged_id,
                    'error': str(e)
                })
                
        return successful, errors