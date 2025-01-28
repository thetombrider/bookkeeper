import click
from commands import add_transaction, view_transactions, create_account, view_accounts, create_category
from account_manager import AccountManager  # Import the AccountManager
from transaction_manager import TransactionManager  # Import the TransactionManager
from category_manager import CategoryManager  # Import the CategoryManager

def load_data():
    """Load all necessary data from files."""
    print("Loading data...")
    try:
        AccountManager.load_accounts()
        print("Accounts loaded successfully")
        CategoryManager.load_categories()
        print("Categories loaded successfully")
        TransactionManager.load_transactions()
        print("Transactions loaded successfully")
    except Exception as e:
        print(f"Error loading data: {e}")


@click.group()
def cli():
    """Welcome to Bookkeeper, a simple accounting CLI tool.
       
       Developed by @thetombrider"""
    # Load data from files at startup
    load_data()

# Add commands to the CLI group
cli.add_command(add_transaction)
cli.add_command(view_transactions)
cli.add_command(create_account)
cli.add_command(view_accounts)
cli.add_command(create_category)

if __name__ == '__main__':
    cli()