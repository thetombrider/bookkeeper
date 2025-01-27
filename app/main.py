import click
from commands import add_transaction, view_transactions, create_account, view_accounts

@click.group()
def cli():
    """Welcome to Bookkeeper, a simple accounting CLI tool.
       
       Developed by @thetombrider"""
    pass

# Add commands to the CLI group
cli.add_command(add_transaction)
cli.add_command(view_transactions)
cli.add_command(create_account)
cli.add_command(view_accounts)

if __name__ == '__main__':
    cli()