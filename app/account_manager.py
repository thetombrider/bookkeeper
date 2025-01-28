import os
import click
from models import Account
from config import ACCOUNT_FILE
from utils.csv_handler import read_csv, write_csv, write_csv_all, initialize_csv_file

ACCOUNT_FIELDS = ['account_id', 'account_name', 'account_balance', 'account_type']

class AccountManager:
    accounts = []
    account_counter = 1  # Start account IDs from 1

    def __init__(self):
        from models import Account  # Move import here to avoid circular import
        self.account = Account()

    @classmethod
    def get_next_account_id(cls):
        return cls.account_counter

    @classmethod
    def increment_account_counter(cls):
        cls.account_counter += 1

    @classmethod
    def load_accounts(cls):
        """Load accounts from CSV file."""
        initialize_csv_file(ACCOUNT_FILE, ACCOUNT_FIELDS)
        
        cls.accounts.clear()
        accounts = read_csv(ACCOUNT_FILE)
        if accounts:
            cls.account_counter = max(int(a.get('account_id', 0)) for a in accounts) + 1

        Account._loading = True
        for row in accounts:
            try:
                account = Account(
                    account_id=int(row.get('account_id', 0)),
                    account_name=row.get('account_name', ''),
                    account_balance=float(row.get('account_balance', 0.0)),
                    account_type=row.get('account_type', '')
                )
                cls.accounts.append(account)
            except ValueError as e:
                print(f"Skipping invalid account: {e}")
        Account._loading = False

    @classmethod
    def add_account(cls, account):
        if cls.account_exists(account.account_name):
            return f"Account '{account.account_name}' already exists. Cannot add duplicate."
        else:
            # Assign the next available account ID
            account.account_id = cls.get_next_account_id()  # Assign the next available account ID
            cls.accounts.append(account)
            cls.increment_account_counter()  # Increment the counter for the next account
            cls.save_account(account) # Save the new account to the file
            cls.load_accounts()  #reload accounts

    @classmethod
    def get_all_account_ids(cls):
        return [account.account_id for account in cls.accounts]

    @classmethod
    def get_account_id_by_name(cls, account_name):
        for account in cls.accounts:
            if account.account_name == account_name:
                return account.account_id
        return None  # Return None if the account does not exist

    @classmethod
    def save_account(cls, account):
        """Save a single account to CSV file."""
        account_data = {
            'account_id': account.account_id,
            'account_name': account.account_name,
            'account_balance': account.account_balance,
            'account_type': account.account_type
        }
        write_csv(ACCOUNT_FILE, account_data, ['account_id', 'account_name', 'account_balance', 'account_type'])

    @classmethod
    def account_exists(cls, account_name):
        """Check if an account exists by name using CSV."""
        accounts = read_csv(ACCOUNT_FILE)
        return any(account['account_name'] == account_name for account in accounts)

    @classmethod
    def get_account_type_by_name(cls, account_name):
        """Retrieve the account type by account name."""
        for account in cls.accounts:
            if account.account_name == account_name:
                return account.account_type
        return None  # Return None if the account does not exist

def read_accounts():
    """Read accounts from CSV file."""
    from models import Account
    accounts = []
    for row in read_csv(ACCOUNT_FILE):
        try:
            accounts.append(Account(
                account_id=int(row['account_id']),
                account_type=row['account_type'],
                account_name=row['account_name'],
                account_balance=float(row['account_balance'])
            ))
        except ValueError as e:
            print(f"Skipping invalid account: {e}")
    return accounts
