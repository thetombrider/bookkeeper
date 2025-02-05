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

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    transaction_date = Column(Date, nullable=False, default=func.current_date())
    description = Column(String, nullable=False)
    status = Column(SQLEnum(TransactionStatus), nullable=False, default=TransactionStatus.COMPLETED)
    reference_number = Column(String)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    journal_entries = relationship("JournalEntry", back_populates="transaction", cascade="all, delete-orphan")

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

class IncomeStatement(BaseModel):
    income: List[dict]
    expenses: List[dict]
    total_income: Decimal
    total_expenses: Decimal
    net_income: Decimal 