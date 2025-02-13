from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import uuid4
from sqlalchemy import Column, String, Enum as SQLEnum, Boolean, Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import relationship
from pydantic import BaseModel

from .database import Base

# Enums
class AccountType(str, Enum):
    ASSET = 'asset'
    LIABILITY = 'liability'
    EQUITY = 'equity'
    INCOME = 'income'
    EXPENSE = 'expense'

class TransactionStatus(str, Enum):
    PENDING = 'pending'
    COMPLETED = 'completed'
    VOID = 'void'

class ImportSourceType(str, Enum):
    CSV = 'csv'
    TALLY = 'tally'
    GOCARDLESS = 'gocardless'

class ImportStatus(str, Enum):
    PENDING = 'pending'
    PROCESSED = 'processed'
    ERROR = 'error'

# SQLAlchemy Models
class AccountCategory(Base):
    __tablename__ = "account_categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    accounts = relationship("Account", back_populates="category")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    category_id = Column(String(36), ForeignKey("account_categories.id"))
    name = Column(String, nullable=False)
    type = Column(SQLEnum(AccountType), nullable=False)
    code = Column(String, nullable=False, unique=True)
    description = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    category = relationship("AccountCategory", back_populates="accounts")
    journal_entries = relationship("JournalEntry", back_populates="account")

class ImportSource(Base):
    __tablename__ = "import_sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    type = Column(SQLEnum(ImportSourceType), nullable=False)
    config = Column(String)  # JSON string for configuration
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    staged_transactions = relationship("StagedTransaction", back_populates="source")
    bank_connections = relationship("BankConnection", back_populates="import_source", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    transaction_date = Column(Date, nullable=False, default=func.current_date())
    description = Column(String, nullable=False)
    status = Column(SQLEnum(TransactionStatus), nullable=False, default=TransactionStatus.COMPLETED)
    reference_number = Column(String)
    staged_transaction_id = Column(String(36), ForeignKey("staged_transactions.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    journal_entries = relationship("JournalEntry", back_populates="transaction", cascade="all, delete-orphan")
    staged_transaction = relationship("StagedTransaction", back_populates="final_transaction", foreign_keys=[staged_transaction_id])

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    transaction_id = Column(String(36), ForeignKey("transactions.id"), nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    debit_amount = Column(Numeric(15, 2), nullable=False, default=0)
    credit_amount = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    transaction = relationship("Transaction", back_populates="journal_entries")
    account = relationship("Account", back_populates="journal_entries")

# Pydantic models for API
class AccountCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class AccountCategoryCreate(AccountCategoryBase):
    pass

class AccountCategoryResponse(AccountCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AccountBase(BaseModel):
    category_id: Optional[str] = None
    name: str
    type: AccountType
    description: Optional[str] = None
    is_active: bool = True

class AccountCreate(AccountBase):
    pass

class AccountResponse(AccountBase):
    id: str
    code: str
    created_at: datetime
    updated_at: datetime
    category: Optional[AccountCategoryResponse] = None

    class Config:
        from_attributes = True

class JournalEntryBase(BaseModel):
    account_id: str
    debit_amount: Decimal = Decimal('0.00')
    credit_amount: Decimal = Decimal('0.00')

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntryResponse(JournalEntryBase):
    id: str
    transaction_id: str
    created_at: datetime
    updated_at: datetime
    account: Optional[AccountResponse] = None

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    transaction_date: date = date.today()
    description: str
    reference_number: Optional[str] = None
    status: TransactionStatus = TransactionStatus.COMPLETED

class TransactionCreate(TransactionBase):
    entries: List[JournalEntryCreate]

class TransactionResponse(TransactionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    journal_entries: List[JournalEntryResponse]

    class Config:
        from_attributes = True

class BalanceSheet(BaseModel):
    assets: List[dict]
    liabilities: List[dict]
    equity: List[dict]
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    net_income: Decimal
    total_liabilities_and_equity: Decimal

class IncomeStatement(BaseModel):
    income: List[dict]
    expenses: List[dict]
    total_income: Decimal
    total_expenses: Decimal
    net_income: Decimal

class ImportSourceBase(BaseModel):
    name: str
    type: ImportSourceType
    config: Optional[str] = None
    is_active: bool = True

class ImportSourceCreate(ImportSourceBase):
    pass

class ImportSourceResponse(ImportSourceBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StagedTransaction(Base):
    __tablename__ = "staged_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id = Column(String(36), ForeignKey("import_sources.id"), nullable=False)
    external_id = Column(String)  # ID from external system if available
    transaction_date = Column(Date, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(SQLEnum(ImportStatus), nullable=False, default=ImportStatus.PENDING)
    account_id = Column(String(36), ForeignKey("accounts.id"))  # The account this transaction affects
    error_message = Column(String)
    raw_data = Column(String)  # Original data in JSON format
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    processed_at = Column(DateTime)

    source = relationship("ImportSource", back_populates="staged_transactions")
    account = relationship("Account")
    final_transaction = relationship("Transaction", back_populates="staged_transaction", foreign_keys=[Transaction.staged_transaction_id])

class StagedTransactionBase(BaseModel):
    source_id: str
    external_id: Optional[str] = None
    transaction_date: date
    description: str
    amount: Decimal
    account_id: Optional[str] = None
    raw_data: Optional[str] = None

class StagedTransactionCreate(StagedTransactionBase):
    pass

class StagedTransactionResponse(StagedTransactionBase):
    id: str
    status: ImportStatus
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None
    source: ImportSourceResponse
    account: Optional[AccountResponse] = None

    class Config:
        from_attributes = True

class BankConnection(Base):
    __tablename__ = "bank_connections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    import_source_id = Column(String(36), ForeignKey("import_sources.id"), nullable=False)
    bank_id = Column(String, nullable=False)  # GoCardless bank ID
    bank_name = Column(String, nullable=False)
    requisition_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default='active')  # active, disconnected
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    import_source = relationship("ImportSource", back_populates="bank_connections")
    bank_accounts = relationship("BankAccount", back_populates="connection", cascade="all, delete-orphan")

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    connection_id = Column(String(36), ForeignKey("bank_connections.id"), nullable=False)
    account_id = Column(String, nullable=False)  # GoCardless account ID
    name = Column(String)
    iban = Column(String)
    currency = Column(String)
    status = Column(String, nullable=False, default='active')  # active, disconnected
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    connection = relationship("BankConnection", back_populates="bank_accounts")

# Add simplified response models to break circular dependencies
class BankAccountBrief(BaseModel):
    id: str
    account_id: str
    name: Optional[str]
    iban: Optional[str]
    currency: Optional[str]
    status: str

    class Config:
        from_attributes = True

class BankConnectionBrief(BaseModel):
    id: str
    bank_id: str
    bank_name: str
    requisition_id: str
    status: str

    class Config:
        from_attributes = True

class BankConnectionResponse(BaseModel):
    id: str
    bank_id: str
    bank_name: str
    requisition_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    bank_accounts: List[BankAccountBrief]

    class Config:
        from_attributes = True

class BankAccountResponse(BaseModel):
    id: str
    account_id: str
    name: Optional[str]
    iban: Optional[str]
    currency: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    connection: Optional[BankConnectionBrief] = None

    class Config:
        from_attributes = True

BankConnectionResponse.model_rebuild()

class BulkDeleteRequest(BaseModel):
    staged_ids: List[str]

    class Config:
        from_attributes = True 