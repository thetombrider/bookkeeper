# commands.py
import click
from datetime import datetime
from models import Transaction, Account, Category
from transaction_manager import TransactionManager
from account_manager import AccountManager
from category_manager import CategoryManager
from config import TRANSACTION_FILE, VALID_ACCOUNT_TYPES
from utils.csv_handler import read_csv

@click.command()
@click.option('--date', prompt='Transaction date (YYYY-MM-DD)', help='The date of the transaction.')
@click.option('--description', prompt='Transaction description', help='A brief description of the transaction.')
@click.option('--amount', prompt='Transaction amount', type=float, help='The amount of the transaction.')
@click.option('--category', prompt='Transaction category', help='The category of the transaction.')
@click.option('--account_name', prompt='Account Name', type=str, help='The Name of the account associated with the transaction.')
@click.option('--transaction_type', prompt='Transaction Type (credit/debit)', type=click.Choice(['credit', 'debit']), help='The type of the transaction.')
def add_transaction(date, description, amount, category, account_name, transaction_type):
    """Add a new transaction."""
    
    # Load categories and accounts before validation
    CategoryManager.load_categories()
    AccountManager.load_accounts()

    # Validate the transaction date
    while True:
        if date.lower() == 'exit':
            click.echo("Transaction cancelled.")
            return
        try:
            # Try to create a transaction to validate the date
            test_transaction = Transaction(
                transaction_id=1,
                transaction_date=date,
                month=date.split('-')[1],
                description='test',
                amount=1.0,  # Use valid amount for date validation
                category=Category(category_name='test'),
                account_name='test',
                account_id=1,
                transaction_type='debit'
            )
            break
        except ValueError as e:
            if "Transaction date cannot be in the future" in str(e):
                click.echo("Error: Transaction date cannot be in the future. Please enter a valid date or type 'exit' to cancel.")
            else:
                click.echo("Error: Invalid date format. Please enter a valid date (YYYY-MM-DD) or type 'exit' to cancel.")
            date = click.prompt("Transaction date (YYYY-MM-DD)", type=str)

    # Validate the transaction amount
    while True:
        if str(amount).lower() == 'exit':
            click.echo("Transaction cancelled.")
            return
        try:
            if amount <= 0:
                raise ValueError("Transaction amount must be greater than zero")
            break
        except ValueError as e:
            click.echo(f"Error: {str(e)}. Please enter a valid amount or type 'exit' to cancel.")
            try:
                amount = float(click.prompt("Transaction amount", type=str))
            except ValueError:
                click.echo("Error: Please enter a valid number.")
                continue

    # Check for valid category first
    while True:
        if category.lower() == 'exit':
            click.echo("Transaction cancelled.")
            return
        if CategoryManager.category_exists(category):
            category_instance = next((cat for cat in CategoryManager.categories if cat.category_name == category), None)
            break
        else:
            click.echo("Category does not exist. Please enter a valid category (or type 'exit' to cancel).")
            category = click.prompt("Transaction category", type=str)

    # After validating the category, check for valid account name
    while True:
        if account_name.lower() == 'exit':
            click.echo("Transaction cancelled.")
            return
        if AccountManager.account_exists(account_name):
            break
        else:
            click.echo("Account does not exist. Please enter a valid account name (or type 'exit' to cancel).")
            account_name = click.prompt("Account Name", type=str)

    try:
        # Create the transaction instance
        transaction = Transaction(
            transaction_id=TransactionManager.get_next_transaction_id(),
            transaction_date=date,
            month=date.split('-')[1],
            description=description,
            amount=amount,
            category=category_instance,
            account_name=account_name,
            account_id=AccountManager.get_account_id_by_name(account_name),
            transaction_type=transaction_type
        )

        # Add the transaction
        TransactionManager.add_transaction(transaction)
        click.echo(f"Transaction added successfully: {description} for {amount}")
    except ValueError as e:
        click.echo(f"Error creating transaction: {str(e)}")
        return

@click.command()
def view_transactions():
    """View all transactions."""
    TransactionManager.load_transactions()
    transactions = read_transactions()  # Ensure this is the correct call
    if not transactions:
        click.echo("No transactions found.")
        return
    for transaction in transactions:
        click.echo(transaction)

def read_transactions():
    """Read transactions from the CSV file."""
    transactions = []
    for row in read_csv(TRANSACTION_FILE):
        try:
            transactions.append({
                'transaction_id': row['transaction_id'],
                'date': row['transaction_date'],
                'month': row['month'],
                'description': row['description'],
                'amount': float(row['amount']),
                'category_name': row['category_id'],
                'account_name': row['account_name'],
                'transaction_type': row['transaction_type']
            })
        except (ValueError, KeyError) as e:
            print(f"Skipping invalid transaction: {e}")
    return transactions

@click.command()
@click.option('--account_type', prompt='Account Type', type=click.Choice(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']), help='The type of the account (e.g., Asset, Liability).')
@click.option('--account_balance', prompt='Account Balance', type=float, help='The initial balance of the account.')
@click.option('--account_name', prompt='Account Name', type=str, help='Account Name')
def create_account(account_type, account_balance, account_name):
    """Create a new account."""
    if account_name.lower() == 'exit':
        click.echo("Account creation cancelled.")
        return

    # Check for duplicate account names
    if AccountManager.account_exists(account_name):
        click.echo(f"Account '{account_name}' already exists. Cannot create duplicate.")
        return

    account = Account(
        account_name=account_name,
        account_balance=account_balance,
        account_type=account_type
    )
    AccountManager.add_account(account)  # This will assign the account_id
    click.echo(f"Account created: {account_name} with balance {account_balance} and type {account_type}.")

@click.command()
def view_accounts():
    """View all accounts."""
    accounts = AccountManager.accounts  # Get accounts from the AccountManager
    if not accounts:
        click.echo("No accounts found.")
        return
    for account in accounts:
        click.echo(f"ID: {account.account_id}, Name: {account.account_name}, Type: {account.account_type}, Balance: {account.account_balance}")

@click.command()
@click.option('--category_name', prompt='Category Name', help='The name of the category to create.')
def create_category(category_name):
    """Create a new category."""
    if category_name.lower() == 'exit':
        click.echo("Category creation cancelled.")
        return

     # Check for duplicate category names
    if CategoryManager.category_exists(category_name):
        click.echo(f"Category '{category_name}' already exists. Cannot create duplicate.")
        return

    # Create the category instance
    category = Category(
        category_name=category_name
    )
    
    # Use the add_category method to handle the creation logic
    CategoryManager.add_category(category)
    click.echo(f"Category created: {category_name}")