import os
from models import Transaction, Category
from account_manager import AccountManager
from category_manager import CategoryManager

TRANSACTION_FILE = "transactions.txt"

def transaction_exists(transaction):
    try:
        with open('transactions.txt', 'r') as f:
            for line in f:
                existing_transaction = line.strip().split(',')
                if (existing_transaction[1] == transaction.date and  # date
                    existing_transaction[2] == transaction.month and  # month
                    existing_transaction[3] == transaction.description and  # description
                    existing_transaction[4] == str(transaction.amount) and  # amount
                    existing_transaction[5] == transaction.category.category_name and  # category
                    existing_transaction[6] == transaction.account_name):  # account_name
                    return True
    except FileNotFoundError:
        return False  # File doesn't exist, so no transactions are present
    return False

def save_transaction(cls, transaction):
    if transaction_exists(transaction):
        print(f"Transaction for '{transaction.description}' on {transaction.date} already exists. Cannot add duplicate.")
        return  # Exit the function if the transaction already exists

    with open(TRANSACTION_FILE, 'a') as f:
        f.write(f"{transaction.transaction_id},{transaction.date},{transaction.month},{transaction.description},{transaction.amount},{transaction.category.category_name},{transaction.account_name},{transaction.account_id},{transaction.transaction_type}\n")

def read_transactions():
    if not os.path.exists(TRANSACTION_FILE):
        print("Transaction file does not exist.")
        return []
    
    with open(TRANSACTION_FILE, "r") as f:
        transactions = []
        for line in f.readlines():
            line = line.strip()  # Strip leading/trailing whitespace
            print(f"Processing line: '{line}'")  # Debugging output
            
            if not line or line.startswith('#'):  # Skip empty lines and comments
                print("Skipping empty line or comment.")
                continue
            
            # Split the line and strip whitespace from each value
            values = [value.strip() for value in line.split(',')]
            print(f"Split values: {values}")  # Debugging output
            print(f"Number of values: {len(values)}")  # Debugging output
            
            if len(values) != 9:  # Ensure there are exactly 9 values
                print(f"Skipping improperly formatted line: {line} (found {len(values)} values)")
                continue
            
            try:
                transaction_id, date, month, description, amount, category_name, account_name, account_id, transaction_type = values
                transactions.append(Transaction(
                    transaction_id=int(transaction_id),
                    date=date,
                    month=month,
                    description=description,
                    amount=float(amount),
                    category=Category(category_name=category_name),  # Assuming you have a way to get the Category instance
                    account_name=account_name,
                    account_id=int(account_id),  # Convert account_id to int
                    transaction_type=transaction_type  # Use transaction_type
                ))
            except ValueError as e:
                print(f"Skipping line due to error: {e} - {line}")
        
        print(f"Total transactions read: {len(transactions)}")  # Debugging output
        return transactions

class TransactionManager:
    transactions = []
    transaction_counter = 1  # Start transaction IDs from 1

    @classmethod
    def get_next_transaction_id(cls):
        return cls.transaction_counter

    @classmethod
    def increment_transaction_counter(cls):
        cls.transaction_counter += 1

    @classmethod
    def load_transactions(cls):
        """Load transactions from the transactions.txt file."""
        cls.transactions.clear()  # Clear existing transactions
        skipped_lines = 0  # Counter for skipped lines

        if os.path.exists(TRANSACTION_FILE):
            with open(TRANSACTION_FILE, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):  # Check if the line is not empty and not a comment
                        values = line.split(',')
                        if len(values) == 9:  # Ensure there are exactly 9 values
                            try:
                                transaction_id, date, month, description, amount, category_name, account_name, account_id, transaction_type = values
                                # Check if the account_id exists before creating the transaction
                                if int(account_id) not in AccountManager.get_all_account_ids():
                                    raise ValueError(f"Account ID {account_id} does not exist. Cannot load transactions.")
                                transaction = Transaction(
                                    transaction_id=int(transaction_id),
                                    date=date,
                                    month=month,
                                    description=description,
                                    amount=float(amount),
                                    category=Category(category_name=category_name),  # Assuming you have a way to get the Category instance
                                    account_name=account_name,
                                    account_id=int(account_id),
                                    transaction_type=transaction_type
                                )
                                cls.transactions.append(transaction)
                            except ValueError as e:
                                skipped_lines += 1  # Increment the skipped lines counter
                                print(f"Skipping line due to error: {e} - {line}")
                        else:
                            skipped_lines += 1  # Increment the skipped lines counter
                            print(f"Skipping line due to incorrect format: {line}")

        if skipped_lines > 0:
            print(f"Total skipped lines during transaction loading: {skipped_lines}")
        if not cls.transactions:
            print("No transactions were loaded from the file.")

    @classmethod
    def add_transaction(cls, transaction):
        # Check if a transaction with the same ID already exists
        if any(t.transaction_id == transaction.transaction_id for t in cls.transactions):
            print(f"Transaction with ID {transaction.transaction_id} already exists. Cannot add duplicate.")
            return  # Exit the function if the transaction ID already exists

        transaction.transaction_id = cls.get_next_transaction_id()  # Assign the next available transaction ID
        cls.transactions.append(transaction)
        cls.increment_transaction_counter()  # Increment the counter for the next transaction
        cls.save_transaction(transaction)  # Save the new transaction to the file
        cls.load_transactions()  # Reload transactions to reflect the new state

        # After creating the transaction, print its details
        print(f"Adding transaction: {transaction.transaction_id}, {transaction.date}, {transaction.month}, {transaction.description}, {transaction.amount}, {transaction.category.category_name}, {transaction.account_name}, {transaction.account_id}, {transaction.transaction_type}")

    @classmethod
    def save_transaction(cls, transaction):
        """Save the transaction to the transactions.txt file."""
        with open(TRANSACTION_FILE, 'a') as f:
            f.write(f"{transaction.transaction_id},{transaction.date},{transaction.month},{transaction.description},{transaction.amount},{transaction.category.category_name},{transaction.account_name},{transaction.account_id},{transaction.transaction_type}\n")
