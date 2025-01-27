from pydantic import BaseModel, Field, field_validator
from account_manager import AccountManager

# Define the Account data model
class Account(BaseModel):
    account_id: int = Field(default=None)  # Allow default None for instantiation
    account_type: str
    account_balance: float
    account_name: str

    @field_validator('account_id')
    def check_account_exists(cls, account_id):
        if account_id is not None and account_id not in AccountManager.get_all_account_ids():
            raise ValueError(f"Account ID {account_id} does not exist.")
        return account_id

# Define the Transaction data model
class Transaction(BaseModel):
    transaction_id: int
    date: str
    month: str
    description: str
    amount: float
    category: str
    account_id: int
    account_name: str
    transaction_type: str  # Add transaction type (credit or debit)

    @field_validator('account_id')
    def check_account_exists(cls, account_id, values):
        # Check if the account_id exists in the accounts list
        if account_id not in AccountManager.get_all_account_ids():
            raise ValueError(f"Account ID {account_id} does not exist.")
        return account_id
