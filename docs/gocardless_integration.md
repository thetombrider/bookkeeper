# GoCardless Bank Connection Integration Plan

## Overview
This enhancement will integrate GoCardless (formerly Nordigen) bank account data functionality into the current bookkeeping application. The integration will allow users to:
1. Connect to their bank accounts
2. Fetch account balances
3. Import transactions automatically
4. Map bank transactions to the staging area for review

## Architecture Integration

### 1. Backend Structure

#### New Models (models.py)
```python
# Enums
class BankConnectionStatus(str, Enum):
    PENDING = 'pending'
    ACTIVE = 'active'
    EXPIRED = 'expired'
    ERROR = 'error'

# SQLAlchemy Models
class BankConnection(Base):
    __tablename__ = "bank_connections"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    institution_id = Column(String, nullable=False)  # GoCardless bank ID
    institution_name = Column(String, nullable=False)
    requisition_id = Column(String, nullable=False)  # GoCardless requisition ID
    link = Column(String)  # Bank authorization link
    status = Column(SQLEnum(BankConnectionStatus), nullable=False, default=BankConnectionStatus.PENDING)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    last_sync = Column(DateTime)
    
    accounts = relationship("BankAccount", back_populates="connection")

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    connection_id = Column(String(36), ForeignKey("bank_connections.id"), nullable=False)
    account_id = Column(String, nullable=False)  # GoCardless account ID
    iban = Column(String)
    name = Column(String, nullable=False)
    local_account = Column(String(36), ForeignKey("accounts.id"))  # Link to local account
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    
    connection = relationship("BankConnection", back_populates="accounts")
    bookkeeping_account = relationship("Account")
```

#### Service Layer Integration (services.py)
```python
class BankingService:
    def __init__(self, db: Session, gocardless_client: GoCardlessClient):
        self.db = db
        self.client = gocardless_client
        self.bookkeeping = BookkeepingService(db)
    
    async def list_available_banks(self, country: str) -> List[dict]:
        """List available banks for a country"""
        
    async def create_bank_connection(self, institution_id: str) -> BankConnection:
        """Create a new bank connection and get authorization link"""
        
    async def get_connection_status(self, connection_id: str) -> BankConnection:
        """Check status of a bank connection"""
        
    async def sync_accounts(self, connection_id: str) -> List[BankAccount]:
        """Sync accounts for a bank connection"""
        
    async def sync_transactions(
        self, 
        account_id: str, 
        from_date: Optional[date] = None
    ) -> List[StagedTransaction]:
        """Sync transactions and create staged transactions"""
        
    async def get_account_balance(self, account_id: str) -> Decimal:
        """Get current balance for a bank account"""

class GoCardlessClient:
    """Wrapper for GoCardless API client from gocardlessconnection"""
    def __init__(self, secret_id: str, secret_key: str):
        self.client = self._init_client(secret_id, secret_key)
    
    # Reuse methods from gocardlessconnection
```

#### API Endpoints Integration (api.py)
```python
# Bank connections endpoints
@app.get("/banks/", response_model=List[dict], tags=["banking"])
async def list_banks(
    country: str,
    db: Session = Depends(get_db)
):
    """List available banks for a country"""

@app.post("/banks/connect", response_model=BankConnection, tags=["banking"])
async def connect_bank(
    institution_id: str,
    db: Session = Depends(get_db)
):
    """Start bank connection process"""

@app.get("/banks/connections/", response_model=List[BankConnection], tags=["banking"])
async def list_connections(
    db: Session = Depends(get_db)
):
    """List all bank connections"""

@app.get("/banks/connections/{connection_id}", response_model=BankConnection, tags=["banking"])
async def get_connection(
    connection_id: str,
    db: Session = Depends(get_db)
):
    """Get bank connection details"""

@app.post("/banks/connections/{connection_id}/sync", tags=["banking"])
async def sync_connection(
    connection_id: str,
    db: Session = Depends(get_db)
):
    """Sync accounts and transactions for a connection"""

@app.get("/banks/accounts/{account_id}/balance", tags=["banking"])
async def get_bank_balance(
    account_id: str,
    db: Session = Depends(get_db)
):
    """Get current balance for a bank account"""
```

### 2. Frontend Integration

#### New Pages

1. `bank-connections.html` - Manage Bank Connections
```html
<section id="bank-connections" class="section">
    <h2>Bank Connections</h2>
    
    <!-- Add New Connection -->
    <div class="form-container">
        <h3>Add Bank Connection</h3>
        <div class="form-group">
            <label for="countrySelect">Country:</label>
            <select id="countrySelect">
                <option value="IT">Italy</option>
                <!-- Add more countries -->
            </select>
        </div>
        <div id="banksList" class="banks-grid">
            <!-- Banks will be loaded here -->
        </div>
    </div>
    
    <!-- Existing Connections -->
    <div class="list-container">
        <h3>Active Connections</h3>
        <div id="connectionsList">
            <!-- Active connections will be loaded here -->
        </div>
    </div>
</section>
```

2. `bank-accounts.html` - View Bank Accounts and Transactions
```html
<section id="bank-accounts" class="section">
    <h2>Bank Accounts</h2>
    
    <!-- Accounts List -->
    <div class="accounts-grid">
        <!-- Bank accounts with balances -->
    </div>
    
    <!-- Transactions -->
    <div class="transactions-container">
        <h3>Recent Transactions</h3>
        <div class="filter-controls">
            <label for="accountFilter">Account:</label>
            <select id="accountFilter">
                <!-- Bank accounts -->
            </select>
            
            <label for="dateRange">Period:</label>
            <input type="date" id="startDate">
            <input type="date" id="endDate">
            
            <button id="syncButton">Sync Transactions</button>
        </div>
        
        <div id="bankTransactions">
            <!-- Transactions will be loaded here -->
        </div>
    </div>
</section>
```

#### JavaScript Modules

1. `banking.js` - Banking functionality
```javascript
export async function loadAvailableBanks(country) {
    // Load and display available banks
}

export async function initiateBankConnection(institutionId) {
    // Start connection process and handle redirect
}

export async function loadBankConnections() {
    // Load and display active connections
}

export async function syncBankData(connectionId) {
    // Sync accounts and transactions
}

export async function loadBankTransactions(accountId, startDate, endDate) {
    // Load bank transactions
}
```

2. `bank-accounts.js` - Bank accounts page handler
```javascript
import { loadBankConnections, syncBankData } from './banking.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize bank accounts page
});
```

### 3. Database Migration
```python
"""add_bank_integration_tables

Revision ID: xxxxxxxxxxxx
Create Date: 2024-02-XX
"""

def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE bank_connection_status AS ENUM ('pending', 'active', 'expired', 'error')")
    
    # Create bank_connections table
    op.create_table(
        'bank_connections',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('institution_id', sa.String, nullable=False),
        sa.Column('institution_name', sa.String, nullable=False),
        sa.Column('requisition_id', sa.String, nullable=False),
        sa.Column('link', sa.String),
        sa.Column('status', sa.Enum('pending', 'active', 'expired', 'error', 
                                  name='bank_connection_status'), 
                  nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, 
                  server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_sync', sa.DateTime)
    )
    
    # Create bank_accounts table
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('connection_id', sa.String(36), 
                  sa.ForeignKey('bank_connections.id'), nullable=False),
        sa.Column('account_id', sa.String, nullable=False),
        sa.Column('iban', sa.String),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('local_account', sa.String(36), 
                  sa.ForeignKey('accounts.id')),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, 
                  server_default=sa.func.now(), onupdate=sa.func.now())
    )
    
    # Add indexes
    op.create_index('idx_bank_connections_status', 'bank_connections', ['status'])
    op.create_index('idx_bank_accounts_connection', 'bank_accounts', ['connection_id'])

def downgrade() -> None:
    op.drop_table('bank_accounts')
    op.drop_table('bank_connections')
    op.execute('DROP TYPE bank_connection_status')
```

### 4. Configuration Updates

1. Environment Variables (`.env`)
```
# GoCardless API Configuration
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
```

2. Dependencies (`requirements.txt`)
```
# Add GoCardless dependencies
gocardless-pro==2.x.x
aiohttp==3.x.x
```

## Implementation Phases

### Phase 1: Backend Infrastructure (5 days)
1. Database migrations and models (1 day)
2. GoCardless client integration (1 day)
3. Banking service implementation (2 days)
4. API endpoints (1 day)

### Phase 2: Frontend Development (4 days)
1. Bank connections page (2 days)
   - Bank selection interface
   - Connection management
   - Status monitoring
2. Bank accounts page (2 days)
   - Accounts overview
   - Transaction syncing
   - Balance display

### Phase 3: Integration & Testing (3 days)
1. Integration with staging area (1 day)
2. Testing and debugging (1 day)
3. Security review and improvements (1 day)

### Phase 4: Documentation & Deployment (2 days)
1. API documentation (0.5 day)
2. User guide (0.5 day)
3. Deployment procedures (1 day)

Total Estimated Time: 14 days

## Security Considerations

1. API Keys
   - Store GoCardless credentials securely
   - Use environment variables
   - Never expose in client-side code

2. Bank Data
   - Encrypt sensitive data
   - Implement proper session handling
   - Add rate limiting for API endpoints

3. User Authorization
   - Implement proper access controls
   - Add audit logging for bank operations
   - Secure webhook endpoints

## Future Enhancements

1. Automatic Transaction Categorization
   - Use bank transaction data to suggest categories
   - Learn from user categorizations
   - Bulk categorization tools

2. Scheduled Syncing
   - Add background tasks for regular syncing
   - Email notifications for sync status
   - Error reporting and recovery

3. Enhanced Analytics
   - Bank account activity reports
   - Spending patterns analysis
   - Cash flow forecasting

4. Multi-Bank Dashboard
   - Unified view of all bank accounts
   - Aggregate balance tracking
   - Cross-bank transfers tracking
``` 