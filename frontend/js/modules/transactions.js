import { API_URL, formatCurrency, parseDecimalNumber } from './config.js';
import { allAccounts, loadAccounts } from './accounts.js';

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

async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const transactions = await response.json();
        
        // Update transactions list
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.innerHTML = generateTransactionsTable(transactions);
            
            // Add event listeners for transaction actions
            transactionsList.addEventListener('click', async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;
                
                const action = button.dataset.action;
                const id = button.dataset.id;
                
                if (action === 'view') {
                    await viewTransaction(id);
                } else if (action === 'delete') {
                    await deleteTransaction(id);
                }
            });
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        throw error;
    }
}

function generateTransactionsTable(transactions) {
    return `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(transaction => `
                    <tr>
                        <td>${transaction.transaction_date}</td>
                        <td>${transaction.description}</td>
                        <td>${transaction.reference_number || ''}</td>
                        <td>${transaction.status}</td>
                        <td class="transaction-actions">
                            <button type="button" data-action="view" data-id="${transaction.id}">View</button>
                            <button type="button" data-action="delete" data-id="${transaction.id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
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
        await loadTransactions();
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
        
        // Get the modal elements
        const modal = document.getElementById('transactionModal');
        const modalBody = modal.querySelector('.modal-body');
        const closeBtn = modal.querySelector('.close-modal');
        
        // Format the transaction details in HTML
        let detailsHtml = `
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

        // Update modal content and show it
        modalBody.innerHTML = detailsHtml;
        modal.style.display = 'block';

        // Close modal when clicking the close button
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // Close modal when clicking outside of it
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

    } catch (error) {
        console.error('Error fetching transaction:', error);
        alert('Error viewing transaction details');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.status === 404) {
            alert('Transaction has already been deleted');
            await loadTransactions(); // Refresh the list
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.detail || `Server error: ${response.status}`);
        }
        
        // Remove the transaction row from the UI immediately
        const transactionRow = document.querySelector(`button[data-id="${id}"]`)?.closest('tr');
        if (transactionRow) {
            transactionRow.remove();
        }
        
        alert('Transaction deleted successfully');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        if (error.message.includes('404') || error.message.includes('not found')) {
            alert('Transaction has already been deleted');
            await loadTransactions(); // Refresh the list to show current state
        } else {
            alert('Error deleting transaction: ' + error.message);
        }
    }
}
