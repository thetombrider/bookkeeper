import { API_URL, formatCurrency, parseDecimalNumber } from './config.js';
import { allAccounts, loadAccounts } from './accounts.js';
import { createModal, showModal, showSuccessMessage, showErrorMessage } from './modal.js';

// Export all functions that are used externally
export {
    loadTransactions,
    addJournalEntryRow,
    removeJournalEntry,
    updateTotals,
    createTransaction,
    viewTransaction,
    deleteTransaction
};

// Add sorting state and cached transactions
let currentSort = {
    column: 'date',
    direction: 'desc'
};
let cachedTransactions = [];

async function loadTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    // Show loading state
    transactionsList.innerHTML = `
        <div class="table-container">
            <div class="table-loading">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/transactions/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        cachedTransactions = await response.json();
        
        // Update transactions list
        updateTransactionsTable();
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        transactionsList.innerHTML = `
            <div class="table-empty">
                <p>Error loading transactions</p>
                <p>${error.message}</p>
            </div>
        `;
        throw error;
    }
}

// Update the table without reloading data
function updateTransactionsTable() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;

    transactionsList.innerHTML = generateTransactionsTable(cachedTransactions);
    
    // Setup interactive features
    setupTableSorting(transactionsList);
    setupTableSearch(transactionsList);
}

function generateTransactionsTable(transactions) {
    // Sort transactions based on current sort state
    const sortedTransactions = sortTransactions(transactions, currentSort);

    return `
        <div class="table-container">
            <div class="table-controls">
                <div class="table-search">
                    <input type="text" 
                           placeholder="Search transactions..." 
                           id="transactionSearch"
                           aria-label="Search transactions">
                </div>
                <div class="table-info">
                    Showing ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}
                </div>
            </div>
            ${transactions.length === 0 ? `
                <div class="table-empty">
                    <p>No transactions found</p>
                    <p>Create a new transaction to get started</p>
                </div>
            ` : `
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th class="sortable ${currentSort.column === 'date' ? `sort-${currentSort.direction}` : ''}" 
                                data-sort="date">Date</th>
                            <th class="sortable ${currentSort.column === 'description' ? `sort-${currentSort.direction}` : ''}" 
                                data-sort="description">Description</th>
                            <th class="sortable ${currentSort.column === 'debit' ? `sort-${currentSort.direction}` : ''}" 
                                data-sort="debit">Debit Account</th>
                            <th class="sortable ${currentSort.column === 'credit' ? `sort-${currentSort.direction}` : ''}" 
                                data-sort="credit">Credit Account</th>
                            <th class="sortable ${currentSort.column === 'status' ? `sort-${currentSort.direction}` : ''}" 
                                data-sort="status">Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedTransactions.map(transaction => {
                            // Find debit and credit accounts
                            const debitEntries = transaction.journal_entries.filter(entry => entry.debit_amount > 0);
                            const creditEntries = transaction.journal_entries.filter(entry => entry.credit_amount > 0);
                            
                            // Format account names
                            const debitAccount = formatAccountsList(debitEntries);
                            const creditAccount = formatAccountsList(creditEntries);
                            
                            return `
                                <tr data-transaction-id="${transaction.id}">
                                    <td>${formatDate(transaction.transaction_date)}</td>
                                    <td title="${transaction.description}">${transaction.description}</td>
                                    <td title="${debitAccount}">${debitAccount}</td>
                                    <td title="${creditAccount}">${creditAccount}</td>
                                    <td>
                                        <span class="status-badge ${transaction.status.toLowerCase()}">
                                            ${transaction.status}
                                        </span>
                                    </td>
                                    <td class="transaction-actions">
                                        <button type="button" data-action="view" data-id="${transaction.id}">View</button>
                                        <button type="button" data-action="delete" data-id="${transaction.id}">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;
}

// Format date consistently
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Format multiple accounts for display
function formatAccountsList(entries) {
    if (entries.length === 0) return '';
    if (entries.length === 1) {
        return `${entries[0].account.code} - ${entries[0].account.name}`;
    }
    // For multiple entries, show first one and indicate there are more
    return `${entries[0].account.code} - ${entries[0].account.name} (+${entries.length - 1} more)`;
}

// Sort transactions based on current sort state
function sortTransactions(transactions, sort) {
    return [...transactions].sort((a, b) => {
        let aVal, bVal;

        switch (sort.column) {
            case 'date':
                aVal = new Date(a.transaction_date).getTime();
                bVal = new Date(b.transaction_date).getTime();
                break;
            case 'description':
                aVal = a.description.toLowerCase();
                bVal = b.description.toLowerCase();
                break;
            case 'debit':
                const aDebit = a.journal_entries.find(e => e.debit_amount > 0);
                const bDebit = b.journal_entries.find(e => e.debit_amount > 0);
                aVal = aDebit ? `${aDebit.account.code} - ${aDebit.account.name}`.toLowerCase() : '';
                bVal = bDebit ? `${bDebit.account.code} - ${bDebit.account.name}`.toLowerCase() : '';
                break;
            case 'credit':
                const aCredit = a.journal_entries.find(e => e.credit_amount > 0);
                const bCredit = b.journal_entries.find(e => e.credit_amount > 0);
                aVal = aCredit ? `${aCredit.account.code} - ${aCredit.account.name}`.toLowerCase() : '';
                bVal = bCredit ? `${bCredit.account.code} - ${bCredit.account.name}`.toLowerCase() : '';
                break;
            case 'status':
                aVal = a.status.toLowerCase();
                bVal = b.status.toLowerCase();
                break;
            default:
                return 0;
        }

        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        const direction = sort.direction === 'asc' ? 1 : -1;
        
        // Compare values
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        
        // Secondary sort by date if primary sort is equal
        if (sort.column !== 'date') {
            const aDate = new Date(a.transaction_date).getTime();
            const bDate = new Date(b.transaction_date).getTime();
            return (bDate - aDate) * direction; // Keep same direction as primary sort
        }
        return 0;
    });
}

// Setup sorting functionality
function setupTableSorting(container) {
    const headers = container.querySelectorAll('th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            
            // Update sort state
            if (currentSort.column === sortKey) {
                // Toggle direction if same column
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // New column, set to desc by default
                currentSort.column = sortKey;
                currentSort.direction = 'desc';
            }

            // Update table with new sort
            updateTransactionsTable();
        });
    });
}

// Add search functionality
function setupTableSearch(container) {
    const searchInput = container.querySelector('#transactionSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = container.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const text = Array.from(row.children)
                .map(cell => cell.textContent)
                .join(' ')
                .toLowerCase();
            
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
        
        // Update count
        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        const info = container.querySelector('.table-info');
        if (info) {
            info.textContent = `Showing ${visibleRows.length} transaction${visibleRows.length !== 1 ? 's' : ''}`;
        }
    });
}

function addJournalEntryRow() {
    // Ensure accounts are loaded
    if (!allAccounts || allAccounts.length === 0) {
        loadAccounts().then(() => {
            createJournalEntryRow();
        });
    } else {
        createJournalEntryRow();
    }
}

function createJournalEntryRow() {
    const entriesList = document.querySelector('.journal-entries-list');
    if (!entriesList) return;

    const newRow = document.createElement('div');
    newRow.className = 'journal-entry-row';
    newRow.innerHTML = `
        <select class="journal-entry-account" required>
            <option value="">Select an account</option>
            ${allAccounts.map(account => `
                <option value="${account.id}">${account.code} - ${account.name}</option>
            `).join('')}
        </select>
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-debit">
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-credit">
        <button type="button" class="remove-entry" title="Remove entry">
            <span>×</span>
        </button>
    `;
    
    entriesList.appendChild(newRow);
    updateTotals();
}

function removeJournalEntry(row) {
    row.remove();
    updateTotals();
}

function updateTotals() {
    let totalDebits = 0;
    let totalCredits = 0;
    
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const debit = parseDecimalNumber(row.querySelector('.journal-entry-debit').value) || 0;
        const credit = parseDecimalNumber(row.querySelector('.journal-entry-credit').value) || 0;
        
        totalDebits += debit;
        totalCredits += credit;
    });
    
    document.getElementById('total-debits').textContent = formatCurrency(totalDebits);
    document.getElementById('total-credits').textContent = formatCurrency(totalCredits);
    
    // Highlight totals if they don't match
    const totalsMatch = Math.abs(totalDebits - totalCredits) < 0.01;
    document.getElementById('total-debits').style.color = totalsMatch ? '#333' : '#dc3545';
    document.getElementById('total-credits').style.color = totalsMatch ? '#333' : '#dc3545';
}

async function createTransaction(transactionData) {
    try {
        const response = await fetch(`${API_URL}/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error creating transaction');
        }
        
        const result = await response.json();
        // Instead of reloading all transactions, just add the new one to the table
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            const table = transactionsList.querySelector('table tbody');
            if (table) {
                const newRow = document.createElement('tr');
                newRow.dataset.transactionId = result.id;
                newRow.innerHTML = `
                    <td>${result.transaction_date}</td>
                    <td>${result.description}</td>
                    <td>${result.reference_number || ''}</td>
                    <td>${result.status}</td>
                    <td class="transaction-actions">
                        <button type="button" data-action="view" data-id="${result.id}">View</button>
                        <button type="button" data-action="delete" data-id="${result.id}">Delete</button>
                    </td>
                `;
                table.insertBefore(newRow, table.firstChild);
            }
        }
        return result;
    } catch (error) {
        console.error('Error creating transaction:', error);
        throw error;
    }
}

async function viewTransaction(id) {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const transaction = await response.json();
        
        // Create modal content
        const detailsHtml = `
            <div class="transaction-detail">
                <h4>Basic Information</h4>
                <div class="transaction-detail-row">
                    <span>Date:</span>
                    <span>${transaction.transaction_date}</span>
                </div>
                <div class="transaction-detail-row">
                    <span>Description:</span>
                    <span>${transaction.description}</span>
                </div>
                <div class="transaction-detail-row">
                    <span>Reference:</span>
                    <span>${transaction.reference_number || '-'}</span>
                </div>
                <div class="transaction-detail-row">
                    <span>Status:</span>
                    <span>${transaction.status}</span>
                </div>
            </div>

            <div class="transaction-entries">
                <h4>Journal Entries</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th>Debit</th>
                            <th>Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transaction.journal_entries.map(entry => {
                            const account = entry.account;
                            return `
                                <tr>
                                    <td>${account.code} - ${account.name}</td>
                                    <td>${formatCurrency(entry.debit_amount)}</td>
                                    <td>${formatCurrency(entry.credit_amount)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="transaction-totals">
                <div class="transaction-total-row">
                    <span>Total Debits:</span>
                    <span>${formatCurrency(transaction.journal_entries.reduce((sum, entry) => sum + parseFloat(entry.debit_amount), 0))}</span>
                </div>
                <div class="transaction-total-row">
                    <span>Total Credits:</span>
                    <span>${formatCurrency(transaction.journal_entries.reduce((sum, entry) => sum + parseFloat(entry.credit_amount), 0))}</span>
                </div>
            </div>
        `;

        // Create and show modal
        const modal = createModal('edit', 'Transaction Details');
        showModal(modal, detailsHtml);

    } catch (error) {
        console.error('Error viewing transaction:', error);
        showErrorMessage('Error viewing transaction details: ' + error.message);
    }
}

async function deleteTransaction(id) {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error deleting transaction');
        }

        // Remove the transaction row from the table
        const row = document.querySelector(`tr[data-transaction-id="${id}"]`);
        if (row) {
            row.remove();
        }

        showSuccessMessage('Transaction deleted successfully!');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showErrorMessage('Error deleting transaction: ' + error.message);
    }
}
