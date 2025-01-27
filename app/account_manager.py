import os
import click
from models import Account
from config import ACCOUNT_FILE  # Import the account file path

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
        """Load accounts from the accounts.txt file."""
        cls.accounts.clear()  # Clear existing accounts
        if os.path.exists(ACCOUNT_FILE):
            with open(ACCOUNT_FILE, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:  # Check if the line is not empty
                        values = line.split(',')
                        if len(values) == 4:  # Ensure there are exactly 4 values
                            account_id, account_name, account_balance, account_type = values
                            account = Account(
                                account_id=int(account_id),
                                account_name=account_name,
                                account_balance=float(account_balance),
                                account_type=account_type
                            )
                            cls.accounts.append(account)
                            cls.account_counter = max(cls.account_counter, account.account_id + 1)  # Update counter

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
        """Save the account to the accounts.txt file."""
        from models import Account  # Move import here to avoid circular import
        with open(ACCOUNT_FILE, 'a') as f:
            f.write(f"{account.account_id},{account.account_name},{account.account_balance},{account.account_type}\n")

    @classmethod
    def account_exists(cls, account_name):
        with open('accounts.txt', 'r') as file:  # Adjust the file path as necessary
            for line in file:
                line = line.strip()
                if line:  # Check if the line is not empty
                    values = line.split(',')
                    if len(values) > 1:  # Ensure there are enough values
                        existing_account_name = values[1]  # Assuming account_name is the second field
                        if existing_account_name == account_name:
                            return True
        return False

    @classmethod
    def get_account_type_by_name(cls, account_name):
        """Retrieve the account type by account name."""
        for account in cls.accounts:
            if account.account_name == account_name:
                return account.account_type
        return None  # Return None if the account does not exist

def read_accounts():
    from models import Account
    if not os.path.exists('accounts.txt'):
        return []
    with open('accounts.txt', "r") as f:
        accounts = []
        for line in f.readlines()[1:]:  # Skip the header line
            account_id, account_type, account_name, account_balance = line.strip().split(',')
            accounts.append(Account(
                account_id=int(account_id),
                account_type=account_type,
                account_name=account_name,
                account_balance=float(account_balance)
            ))
        return accounts
