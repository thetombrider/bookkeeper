import os
from models import Transaction, Category
from account_manager import AccountManager
from category_manager import CategoryManager
from config import TRANSACTION_FILE
from utils.csv_handler import read_csv, write_csv, write_csv_all, initialize_csv_file

TRANSACTION_FIELDS = [
    'transaction_id',
    'transaction_date',
    'account_id',
    'description',
    'amount',
    'category_id',
    'account_name',
    'transaction_type'
]

def transaction_exists(transaction):
    """Check if a transaction exists using CSV."""
    transactions = read_csv(TRANSACTION_FILE)
    return any(
        t['transaction_date'] == transaction.date and
        t['account_id'] == transaction.account_id and
        t['description'] == transaction.description and
        str(t['amount']) == str(transaction.amount) and
        t['category_id'] == transaction.category.category_name and
        t['account_name'] == transaction.account_name
        for t in transactions
    )

def save_transaction(transaction):
    """Save a single transaction to CSV file."""
    transaction_data = {
        'transaction_id': transaction.transaction_id,
        'transaction_date': transaction.date,
        'account_id': transaction.account_id,
        'description': transaction.description,
        'amount': transaction.amount,
        'category_id': transaction.category.category_name,
        'account_name': transaction.account_name,
        'transaction_type': '1' if transaction.transaction_type == 'credit' else '0'
    }
    write_csv(TRANSACTION_FILE, transaction_data, TRANSACTION_FIELDS)

def read_transactions():
    """Read all transactions from CSV file."""
    transactions = []
    for row in read_csv(TRANSACTION_FILE):
        try:
            # Map numeric transaction_type to string
            transaction_type = 'credit' if row['transaction_type'] == '1' else 'debit'
            
            transaction = Transaction(
                transaction_id=int(row['transaction_id']),
                date=row['transaction_date'],
                month=row['transaction_date'].split('-')[1],
                description=row['description'],
                amount=float(row['amount']),
                category=Category(category_name=row['category_id']),
                account_name=row['account_name'],
                account_id=int(row['account_id']),
                transaction_type=transaction_type
            )
            transactions.append(transaction)
        except ValueError as e:
            print(f"Skipping invalid transaction: {e}")
    return transactions

class TransactionManager:
    transactions = []
    transaction_counter = 1

    @classmethod
    def get_next_transaction_id(cls):
        """Get the next available transaction ID."""
        return cls.transaction_counter

    @classmethod
    def increment_transaction_counter(cls):
        """Increment the transaction counter after using an ID."""
        cls.transaction_counter += 1

    @classmethod
    def load_transactions(cls):
        """Load transactions from CSV file."""
        initialize_csv_file(TRANSACTION_FILE, TRANSACTION_FIELDS)
        
        cls.transactions.clear()
        skipped_lines = 0
        seen_transaction_ids = set()  # Track seen transaction IDs

        for row in read_csv(TRANSACTION_FILE):
            try:
                transaction_id = int(row['transaction_id'])
                
                # Skip duplicate transaction IDs
                if transaction_id in seen_transaction_ids:
                    print(f"Warning: Duplicate transaction ID found: {transaction_id}. Skipping...")
                    skipped_lines += 1
                    continue
                
                if int(row['account_id']) not in AccountManager.get_all_account_ids():
                    raise ValueError(f"Account ID {row['account_id']} does not exist.")
                
                transaction_type = 'credit' if row['transaction_type'] == '1' else 'debit'
                
                transaction = Transaction(
                    transaction_id=transaction_id,
                    transaction_date=row['transaction_date'],
                    month=row['transaction_date'].split('-')[1],
                    description=row['description'],
                    amount=float(row['amount']),
                    category=Category(category_name=row['category_id']),
                    account_name=row['account_name'],
                    account_id=int(row['account_id']),
                    transaction_type=transaction_type
                )
                cls.transactions.append(transaction)
            except ValueError as e:
                skipped_lines += 1
                print(f"Skipping line due to error: {e}")

        if skipped_lines > 0:
            print(f"Total skipped lines during transaction loading: {skipped_lines}")
        if not cls.transactions:
            print("No transactions were loaded from the file.")

        # Update transaction counter based on existing transactions
        if cls.transactions:
            cls.transaction_counter = max(t.transaction_id for t in cls.transactions) + 1

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
        """Save a single transaction to CSV file."""
        transaction_data = {
            'transaction_id': transaction.transaction_id,
            'transaction_date': transaction.date,
            'account_id': transaction.account_id,
            'description': transaction.description,
            'amount': transaction.amount,
            'category_id': transaction.category.category_name,
            'account_name': transaction.account_name,
            'transaction_type': '1' if transaction.transaction_type == 'credit' else '0'
        }
        write_csv(TRANSACTION_FILE, transaction_data, TRANSACTION_FIELDS)

def get_next_transaction_id():
    """Get next transaction ID from CSV file."""
    transactions = read_csv(TRANSACTION_FILE)
    if not transactions:
        return 1
    return max(int(t['transaction_id']) for t in transactions) + 1

# Update the transaction addition logic
transaction_id = get_next_transaction_id()
# Use transaction_id when adding the new transaction
