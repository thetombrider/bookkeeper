import os

class AccountManager:
    accounts = []
    account_counter = 1  # Start account IDs from 1

    def __init__(self):
        from models import Account  # Move import here to avoid circular import
        self.account = Account()

    @classmethod
    def add_account(cls, account):
        account.account_id = cls.account_counter  # Assign the next available account ID
        cls.accounts.append(account)
        cls.account_counter += 1  # Increment the counter for the next account

    @classmethod
    def get_all_account_ids(cls):
        return [account.account_id for account in cls.accounts]

def account_exists(account_name):
    try:
        with open('accounts.txt', 'r') as f:
            for line in f:
                existing_account_name = line.strip().split(',')[1]  # Assuming account_name is the second field
                if existing_account_name == account_name:
                    return True
    except FileNotFoundError:
        return False  # File doesn't exist, so no accounts are present
    return False

def save_account(account):
    if account_exists(account.account_name):
        print(f"Account '{account.account_name}' already exists. Cannot add duplicate.")
        return  # Exit the function if the account already exists

    with open('accounts.txt', 'a') as f:
        f.write(f"{account.account_id},{account.account_name},{account.account_balance}\n")  # Adjust based on your Account model

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
