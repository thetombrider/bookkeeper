# commands.py
import click
from datetime import datetime
from models import Transaction, Account
from transaction_manager import TransactionManager, save_transaction, read_transactions
from account_manager import AccountManager, save_account

@click.command()
@click.option('--date', prompt='Transaction date (YYYY-MM-DD)', help='The date of the transaction.')
@click.option('--description', prompt='Transaction description', help='A brief description of the transaction.')
@click.option('--amount', prompt='Transaction amount', type=float, help='The amount of the transaction.')
@click.option('--category', prompt='Transaction category', help='The category of the transaction.')
@click.option('--account_name', prompt='Account Name', type=str, help='The Name of the account associated with the transaction.')
@click.option('--account_id', prompt='Account ID', type=int, help='The ID of the account associated with the transaction.')
def add_transaction(date, description, amount, category, account_name, account_id):
    """Add a new transaction."""
    month = datetime.strptime(date, "%Y-%m-%d").strftime("%B")
    transaction_id = TransactionManager.get_next_transaction_id()
    transaction = Transaction(
        transaction_id=transaction_id,
        date=date,
        month=month,
        description=description,
        amount=amount,
        category=category,
        account_id=account_id,
        account_name=account_name
    )
    save_transaction(transaction)
    TransactionManager.increment_transaction_counter()  # Increment the transaction counter
    click.echo(f"Transaction added: {transaction}")

@click.command()
def view_transactions():
    """View all transactions."""
    transactions = read_transactions()
    if not transactions:
        click.echo("No transactions found.")
        return
    for transaction in transactions:
        click.echo(transaction)

@click.command()
@click.option('--account_type', prompt='Account Type', help='The type of the account (e.g., asset, liability).')
@click.option('--account_balance', prompt='Account Balance', type=float, help='The initial balance of the account.')
@click.option('--account_name', prompt='Account Name', type=str, help='Account Name')
def create_account(account_type, account_balance, account_name):
    """Create a new account."""
    account = Account(
        account_name=account_name,
        account_balance=account_balance,
        account_type=account_type
    )
    AccountManager.add_account(account)  # This will assign the account_id
    save_account(account)
    click.echo(f"Account created: {account}")

@click.command()
def view_accounts():
    """View all accounts."""
    accounts = AccountManager.accounts  # Get accounts from the AccountManager
    if not accounts:
        click.echo("No accounts found.")
        return
    for account in accounts:
        click.echo(f"ID: {account.account_id}, Name: {account.account_name}, Type: {account.account_type}, Balance: {account.account_balance}")