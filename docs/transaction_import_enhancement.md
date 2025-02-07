# Transaction Import Enhancement Plan

## Overview
This enhancement will add the ability to import transactions from two sources:
1. Tally.so form webhooks
2. CSV file uploads

The imported transactions will be stored in a staging area where they can be manually reviewed and "closed" according to double-entry bookkeeping principles before being imported into the main transaction system.

## Data Models

### Source Data Model (Italian Format)
```
Data (Date)
Mese (Month)
Descrizione (Description)
Importo Entrata (Income Amount)
Importo Uscita (Expense Amount)
Categoria (Category)
Conto (Account)
```

### SQLAlchemy & Pydantic Models (models.py)
```python
# Enums
class ImportSource(str, Enum):
    TALLY = 'tally'
    CSV = 'csv'

class StagedTransactionStatus(str, Enum):
    PENDING = 'pending'
    CLOSED = 'closed'
    IMPORTED = 'imported'

# SQLAlchemy Model
class StagedTransaction(Base):
    __tablename__ = "staged_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source = Column(SQLEnum(ImportSource), nullable=False)
    source_id = Column(String)
    transaction_date = Column(Date, nullable=False)
    month = Column(String)
    description = Column(String, nullable=False)
    income_amount = Column(Numeric(15, 2))
    expense_amount = Column(Numeric(15, 2))
    category_name = Column(String)
    account_name = Column(String)
    status = Column(SQLEnum(StagedTransactionStatus), nullable=False, default=StagedTransactionStatus.PENDING)
    paired_with_id = Column(String(36), ForeignKey("staged_transactions.id"))
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    paired_transaction = relationship("StagedTransaction", remote_side=[id])

# Pydantic Models
class StagedTransactionBase(BaseModel):
    transaction_date: date
    month: Optional[str]
    description: str
    income_amount: Optional[Decimal]
    expense_amount: Optional[Decimal]
    category_name: Optional[str]
    account_name: Optional[str]

class StagedTransactionCreate(StagedTransactionBase):
    source: ImportSource
    source_id: Optional[str]

class StagedTransactionUpdate(StagedTransactionBase):
    status: Optional[StagedTransactionStatus]
    paired_with_id: Optional[str]

class StagedTransactionResponse(StagedTransactionBase):
    id: str
    source: ImportSource
    source_id: Optional[str]
    status: StagedTransactionStatus
    paired_with_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

## Implementation Integration

### 1. Service Layer Integration (services.py)
```python
class BookkeepingService:
    # Add new methods to existing service class
    
    def create_staged_transaction(self, data: StagedTransactionCreate) -> StagedTransaction:
        # Create a new staged transaction
        
    def list_staged_transactions(
        self,
        status: Optional[StagedTransactionStatus] = None,
        source: Optional[ImportSource] = None
    ) -> List[StagedTransaction]:
        # List staged transactions with optional filters
        
    def get_staged_transaction(self, id: str) -> Optional[StagedTransaction]:
        # Get a single staged transaction
        
    def update_staged_transaction(
        self,
        id: str,
        data: StagedTransactionUpdate
    ) -> Optional[StagedTransaction]:
        # Update a staged transaction
        
    def pair_staged_transactions(
        self,
        id1: str,
        id2: str
    ) -> Tuple[StagedTransaction, StagedTransaction]:
        # Pair two staged transactions
        
    def import_staged_transaction_pair(
        self,
        pair_id: str
    ) -> Transaction:
        # Import a paired transaction into the main system

class ImportProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.service = BookkeepingService(db)

    def process_tally_webhook(self, webhook_data: dict) -> StagedTransaction:
        # Process Tally webhook data
        
    def process_csv_row(self, row: dict) -> StagedTransaction:
        # Process a single CSV row
```

### 2. API Endpoints Integration (api.py)
```python
# Add new endpoints to existing FastAPI app

@app.post("/webhooks/tally", response_model=StagedTransactionResponse, tags=["import"])
async def tally_webhook(
    webhook_data: dict,
    db: Session = Depends(get_db)
):
    """Process Tally.so webhook data"""
    processor = ImportProcessor(db)
    return processor.process_tally_webhook(webhook_data)

@app.post("/import/csv", response_model=List[StagedTransactionResponse], tags=["import"])
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Import transactions from CSV file"""
    processor = ImportProcessor(db)
    results = []
    # Process CSV file
    return results

@app.get("/staged-transactions/", response_model=List[StagedTransactionResponse], tags=["import"])
async def list_staged_transactions(
    status: Optional[StagedTransactionStatus] = None,
    source: Optional[ImportSource] = None,
    db: Session = Depends(get_db)
):
    """List staged transactions with optional filters"""
    service = BookkeepingService(db)
    return service.list_staged_transactions(status=status, source=source)

@app.get("/staged-transactions/{id}", response_model=StagedTransactionResponse, tags=["import"])
async def get_staged_transaction(
    id: str,
    db: Session = Depends(get_db)
):
    """Get a specific staged transaction"""
    service = BookkeepingService(db)
    transaction = service.get_staged_transaction(id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Staged transaction not found")
    return transaction

@app.put("/staged-transactions/{id}", response_model=StagedTransactionResponse, tags=["import"])
async def update_staged_transaction(
    id: str,
    data: StagedTransactionUpdate,
    db: Session = Depends(get_db)
):
    """Update a staged transaction"""
    service = BookkeepingService(db)
    transaction = service.update_staged_transaction(id, data)
    if not transaction:
        raise HTTPException(status_code=404, detail="Staged transaction not found")
    return transaction

@app.post("/staged-transactions/{id}/pair", response_model=List[StagedTransactionResponse], tags=["import"])
async def pair_transactions(
    id: str,
    pair_id: str,
    db: Session = Depends(get_db)
):
    """Pair two staged transactions"""
    service = BookkeepingService(db)
    try:
        return service.pair_staged_transactions(id, pair_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/staged-transactions/{pair_id}/import", response_model=TransactionResponse, tags=["import"])
async def import_paired_transaction(
    pair_id: str,
    db: Session = Depends(get_db)
):
    """Import a paired transaction into the main system"""
    service = BookkeepingService(db)
    try:
        return service.import_staged_transaction_pair(pair_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### 3. Database Migration
```python
"""add_staged_transactions_table

Revision ID: xxxxxxxxxxxx
Create Date: 2024-02-XX
"""
from alembic import op
import sqlalchemy as sa
from backend.models import ImportSource, StagedTransactionStatus

def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE import_source AS ENUM ('tally', 'csv')")
    op.execute("CREATE TYPE staged_transaction_status AS ENUM ('pending', 'closed', 'imported')")
    
    # Create staged_transactions table
    op.create_table(
        'staged_transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('source', sa.Enum('tally', 'csv', name='import_source'), nullable=False),
        sa.Column('source_id', sa.String),
        sa.Column('transaction_date', sa.Date, nullable=False),
        sa.Column('month', sa.String),
        sa.Column('description', sa.String, nullable=False),
        sa.Column('income_amount', sa.Numeric(15, 2)),
        sa.Column('expense_amount', sa.Numeric(15, 2)),
        sa.Column('category_name', sa.String),
        sa.Column('account_name', sa.String),
        sa.Column('status', sa.Enum('pending', 'closed', 'imported', name='staged_transaction_status'), nullable=False, server_default='pending'),
        sa.Column('paired_with_id', sa.String(36), sa.ForeignKey('staged_transactions.id')),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    )
    
    # Add indexes
    op.create_index('idx_staged_status', 'staged_transactions', ['status'])
    op.create_index('idx_staged_date', 'staged_transactions', ['transaction_date'])

def downgrade() -> None:
    op.drop_table('staged_transactions')
    op.execute('DROP TYPE staged_transaction_status')
    op.execute('DROP TYPE import_source')
```

## Testing Integration

### 1. Unit Tests
```python
# test_services.py
def test_create_staged_transaction(db_session):
    service = BookkeepingService(db_session)
    data = StagedTransactionCreate(...)
    transaction = service.create_staged_transaction(data)
    assert transaction.id is not None

# test_import_processor.py
def test_process_tally_webhook(db_session):
    processor = ImportProcessor(db_session)
    webhook_data = {...}
    transaction = processor.process_tally_webhook(webhook_data)
    assert transaction.source == ImportSource.TALLY
```

### 2. Integration Tests
```python
# test_api.py
async def test_tally_webhook_endpoint(client, db_session):
    response = await client.post("/webhooks/tally", json={...})
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "tally"
```

## Security Considerations

1. Webhook Security
   - Add Tally.so signature verification to webhook endpoint
   - Implement rate limiting using FastAPI middleware
   - Add request size limits

2. CSV Security
   - Add file size limit to FastAPI upload
   - Implement CSV content validation
   - Sanitize input data

## Timeline Update

1. Phase 1: Backend Infrastructure - 4 days
   - Database migration - 1 day
   - Models and service layer - 2 days
   - API endpoints - 1 day

2. Phase 2: Frontend Integration - 5 days
   - New pages and components - 3 days
   - API integration - 2 days

3. Phase 3: Testing & Security - 3 days
   - Unit tests - 1 day
   - Integration tests - 1 day
   - Security implementation - 1 day

4. Documentation & Deployment - 2 days
   - API documentation - 1 day
   - Deployment guide - 1 day

Total Estimated Time: 2 weeks 