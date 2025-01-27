# Bookkeeper

## Welcome to Bookkeeper!

Bookkeeper is a simple command-line accounting tool designed to help you manage your finances. It allows you to create accounts, add transactions, and view your financial records easily.

## Features

- Create and manage accounts
- Add transactions with details such as date, description, amount, and category
- View all transactions and accounts
- Simple command-line interface using Click and Pydantic for data validation

## Installation

To get started with Bookkeeper, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/bookkeeper.git
   cd bookkeeper
   ```

2. **Set up a virtual environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On macOS/Linux
   venv\Scripts\activate  # On Windows
   ```

3. **Install the required packages**:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

To run the Bookkeeper CLI, use the following command:

bash
python -m bookkeeper.main


### Available Commands

- **Create Account**: Create a new account with a specified type and balance.
- **Add Transaction**: Add a new transaction to an existing account.
- **View Transactions**: Display all transactions recorded in the system.
- **View Accounts**: Display all accounts created in the system.

### Example Commands

1. Create a new account:
   ```bash
   python -m bookkeeper.main create_account
   ```

2. Add a transaction:
   ```bash
   python -m bookkeeper.main add_transaction
   ```

3. View all transactions:
   ```bash
   python -m bookkeeper.main view_transactions
   ```

4. View all accounts:
   ```bash
   python -m bookkeeper.main view_accounts
   ```

## File Structure
bookkeeper/
│
├── app/
│ ├── init.py
│ ├── account_manager.py
│ ├── commands.py
│ ├── main.py
│ ├── models.py
│ ├── transaction_manager.py
│
├── .gitignore
├── README.md
├── requirements.txt
└── setup.py

##Acknowledgements
- [Click](https://click.palletsprojects.com/) for the command-line interface.
- [Pydantic](https://pydantic-docs.helpmanual.io/) for data validation and settings management.