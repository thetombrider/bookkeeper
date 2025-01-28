from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

# Define the Account data model
class Account(BaseModel):
    account_id: int = Field(default=None)  # Allow default None for instantiation
    account_type: str
    account_balance: float
    account_name: str

    # Class variable to indicate loading state
    _loading = False

    @field_validator('account_id', mode='before')
    def check_account_exists(cls, account_id):
        if cls._loading:
            return account_id  # Skip validation if loading
        from account_manager import AccountManager
        # Allow account_id to be set without validation when loading from file
        if account_id is not None and account_id not in AccountManager.get_all_account_ids():
            raise ValueError(f"Account ID {account_id} does not exist.")
        return account_id

# Define the Category data model
class Category(BaseModel):
    category_id: int = Field(default=None)  # Allow default None for instantiation
    category_name: str

    # Class variable to indicate loading state
    _loading = False

    @field_validator('category_id', mode='before')
    def check_category_exists(cls, category_id):
        if cls._loading:
            return category_id  # Skip validation if loading
        # Use a method to validate category ID without direct import
        from category_manager import CategoryManager
        if category_id is not None and not CategoryManager.is_valid_category_id(category_id):
            raise ValueError(f"Category ID {category_id} does not exist.")
        return category_id

    def to_row(self):
        """Convert the category to a row format for saving to a file."""
        return f"{self.category_id},{self.category_name}\n"

    @classmethod
    def get_all_categories(cls):
        # This method can be used to retrieve all categories from a data source
        pass

# Define the Transaction data model
class Transaction(BaseModel):
    transaction_id: int
    date: str = Field(alias='transaction_date')  # Allow 'transaction_date' as an alias for 'date'
    month: str
    description: str
    amount: float
    category: Category  # Reference to the Category model
    account_id: int
    account_name: str
    transaction_type: str  # Add transaction type (credit or debit)

    @field_validator('date')
    def validate_date(cls, date_str):
        try:
            transaction_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            current_date = datetime.now().date()
            
            if transaction_date > current_date:
                raise ValueError("Transaction date cannot be in the future")
            
            return date_str
        except ValueError as e:
            if "Transaction date cannot be in the future" in str(e):
                raise
            raise ValueError("Invalid date format. Use YYYY-MM-DD")

    @field_validator('amount')
    def validate_amount(cls, amount):
        if amount <= 0:
            raise ValueError("Transaction amount must be greater than zero")
        return amount

    @field_validator('account_id')
    def check_account_exists(cls, account_id, values):
        # Check if the account_id exists in the accounts list
        from account_manager import AccountManager
        if account_id not in AccountManager.get_all_account_ids():
            raise ValueError(f"Account ID {account_id} does not exist.")
        return account_id

    @field_validator('transaction_type')
    def validate_transaction_type(cls, transaction_type):
        if transaction_type not in ['credit', 'debit']:
            raise ValueError("Transaction type must be either 'credit' or 'debit'.")
        return transaction_type

    class Config:
        populate_by_name = True  # Allow population by alias names
