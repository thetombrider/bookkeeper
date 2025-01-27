import os
from models import Transaction

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
                    existing_transaction[5] == transaction.category and  # category
                    existing_transaction[6] == transaction.account_name):  # account_name
                    return True
    except FileNotFoundError:
        return False  # File doesn't exist, so no transactions are present
    return False

def save_transaction(transaction):
    if transaction_exists(transaction):
        print(f"Transaction for '{transaction.description}' on {transaction.date} already exists. Cannot add duplicate.")
        return  # Exit the function if the transaction already exists

    with open('transactions.txt', 'a') as f:
        f.write(f"{transaction.transaction_id},{transaction.date},{transaction.month},{transaction.description},{transaction.amount},{transaction.category},{transaction.account_name}\n")

def read_transactions():
    if not os.path.exists(TRANSACTION_FILE):
        return []
    with open(TRANSACTION_FILE, "r") as f:
        transactions = []
        for line in f.readlines():
            transaction_id, date, month, description, amount, category, account_name = line.strip().split(',')
            transactions.append(Transaction(
                transaction_id=int(transaction_id),
                date=date,
                month=month,
                description=description,
                amount=float(amount),
                category=category,
                account_name=account_name
            ))
        return transactions

class TransactionManager:
    transaction_counter = 1  # Start transaction IDs from 1

    @classmethod
    def get_next_transaction_id(cls):
        return cls.transaction_counter

    @classmethod
    def increment_transaction_counter(cls):
        cls.transaction_counter += 1
