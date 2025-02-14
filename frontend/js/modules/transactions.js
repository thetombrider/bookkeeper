import { API_URL, formatCurrency, parseDecimalNumber } from './config.js';
import { allAccounts, loadAccounts } from './accounts.js';
import { showConfirmDialog, showSuccessMessage, showErrorMessage } from './modal.js';
import { auth } from './auth.js';
import { loadCategories } from './categories.js';

// State
let allTransactions = [];
let isInitialized = false;

// Add sorting state and cached transactions
let currentSort = {
    column: 'date',
    direction: 'desc'
};
let cachedTransactions = [];

// Functions
async function loadTransactions() {
    try {
        // Check authentication first
        if (!auth.requireAuth()) {
            return [];
        }

        // Load accounts first for the dropdowns
        await loadAccounts();
        
        // Load transactions with auth header
        const response = await fetch(`${API_URL}/transactions/`, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout(); // Redirect to login if unauthorized
                return [];
            }
            throw new Error('Failed to load transactions');
        }
        const data = await response.json();
        
        // Update state
        allTransactions = [...data];
        
        // Update UI only if table exists
        const table = document.getElementById('transactionsTable');
        if (table) {
            updateTransactionsTable(allTransactions);
        }
        
        // Populate account filter dropdown only if it exists
        const filterAccountSelect = document.getElementById('filterAccount');
        if (filterAccountSelect) {
            filterAccountSelect.innerHTML = `
                <option value="">All accounts</option>
                ${allAccounts.map(account => `
                    <option value="${account.id}">${account.name}</option>
                `).join('')}
            `;
        }
        
        // Check accounts availability
        if (!allAccounts || allAccounts.length === 0) {
            console.error('No accounts loaded');
            showErrorMessage('No accounts available. Please create some accounts first.');
        }
        
        return data;
    } catch (error) {
        console.error('Error loading transactions:', error);
        if (error.message.includes('401')) {
            auth.logout(); // Redirect to login if unauthorized
            return [];
        }
        showErrorMessage('Error loading transactions: ' + error.message);
        return [];
    }
}

function updateTransactionsTable(transactions = allTransactions) {
    const table = document.getElementById('transactionsTable');
    if (!table) {
        console.error('Transaction table element not found');
        return;
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
        console.error('Transaction table body not found');
        return;
    }

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No transactions found
                </td>
            </tr>
        `;
        return;
    }

    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.transaction_date) - new Date(a.transaction_date)
    );

    // Add new content
    tbody.innerHTML = sortedTransactions.map(transaction => {
        const debitEntries = transaction.journal_entries.filter(entry => entry.debit_amount > 0);
        const creditEntries = transaction.journal_entries.filter(entry => entry.credit_amount > 0);
        const amount = debitEntries.reduce((sum, entry) => sum + parseFloat(entry.debit_amount), 0);

        return `
            <tr>
                <td>${formatDate(transaction.transaction_date)}</td>
                <td>${transaction.description}</td>
                <td>${formatAccountsList(debitEntries)}</td>
                <td>${formatAccountsList(creditEntries)}</td>
                <td class="text-end numeric">${formatCurrency(amount)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-2" data-action="view" data-id="${transaction.id}">
                        <i class="bi bi-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${transaction.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('it-IT');
}

function formatAccountsList(entries) {
    if (!entries || entries.length === 0) return '-';
    if (entries.length === 1) {
        return `${entries[0].account.name}`;
    }
    return `${entries[0].account.name} (+${entries.length - 1} more)`;
}

function showTransactionForm() {
    const formContainer = document.getElementById('transactionForm');
    const form = document.getElementById('transactionEditForm');
    const entriesList = document.querySelector('.journal-entries-list');
    
    if (formContainer) {
        formContainer.style.display = 'block';
    }
    
    if (form && entriesList) {
        form.reset();
        // Clear existing entries
        entriesList.innerHTML = '';
        // Add initial journal entry row
        addJournalEntryRow();
        // Reset totals
        updateTotals();
    }
}

function hideTransactionForm() {
    const formContainer = document.getElementById('transactionForm');
    const form = document.getElementById('transactionEditForm');
    const entriesList = document.querySelector('.journal-entries-list');
    
    if (formContainer) {
        formContainer.style.display = 'none';
    }
    
    if (form && entriesList) {
        form.reset();
        // Keep only one entry row
        entriesList.innerHTML = '';
        // Add a fresh journal entry row
        addJournalEntryRow();
        // Reset totals
        updateTotals();
    }
}

function addJournalEntryRow() {
    console.log('Adding new journal entry row');  // Debug log
    
    // Get the list and template
    const entriesList = document.querySelector('.journal-entries-list');
    const template = document.getElementById('journalEntryTemplate');
    
    if (!entriesList || !template) {
        console.error('Required elements not found:', { entriesList: !!entriesList, template: !!template });
        return;
    }

    try {
        // Clone the template content
        const newRow = template.content.cloneNode(true);
        
        // Get references to elements in the cloned content
        const select = newRow.querySelector('.journal-entry-account');
        const debitInput = newRow.querySelector('.journal-entry-debit');
        const creditInput = newRow.querySelector('.journal-entry-credit');
        const removeBtn = newRow.querySelector('[data-action="remove-entry"]');

        // Populate accounts dropdown
        if (select && allAccounts) {
            select.innerHTML = `
                <option value="">Select account...</option>
            ${allAccounts.map(account => `
                    <option value="${account.id}">${account.name}</option>
            `).join('')}
            `;
        }

        // Add the row to the DOM
    entriesList.appendChild(newRow);

        // Now get references to the actual elements in the DOM
        const addedRow = entriesList.lastElementChild;
        const addedSelect = addedRow.querySelector('.journal-entry-account');
        const addedDebitInput = addedRow.querySelector('.journal-entry-debit');
        const addedCreditInput = addedRow.querySelector('.journal-entry-credit');
        const addedRemoveBtn = addedRow.querySelector('[data-action="remove-entry"]');

        // Set up event listeners
        if (addedSelect) {
            addedSelect.addEventListener('change', () => validateAccountUsage(addedSelect));
        }

        if (addedDebitInput) {
            addedDebitInput.addEventListener('input', function() {
                if (this.value && this.value !== '0') {
                    addedCreditInput.value = '';
                }
                updateTotals();
            });
        }

        if (addedCreditInput) {
            addedCreditInput.addEventListener('input', function() {
                if (this.value && this.value !== '0') {
                    addedDebitInput.value = '';
                }
                updateTotals();
            });
        }

        if (addedRemoveBtn) {
            addedRemoveBtn.addEventListener('click', function() {
                addedRow.remove();
                updateTotals();
            });
        }

        // Update totals after adding the row
    updateTotals();
        console.log('Journal entry row added successfully');
        
    } catch (error) {
        console.error('Error adding journal entry row:', error);
    }
}

function removeJournalEntry(row) {
    if (row) {
    row.remove();
    updateTotals();
    }
}

function updateTotals() {
    let totalDebits = 0;
    let totalCredits = 0;
    
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const debit = parseFloat(row.querySelector('.journal-entry-debit').value) || 0;
        const credit = parseFloat(row.querySelector('.journal-entry-credit').value) || 0;
        
        totalDebits += debit;
        totalCredits += credit;
    });
    
    const debitsElement = document.getElementById('total-debits');
    const creditsElement = document.getElementById('total-credits');
    
    if (debitsElement) debitsElement.textContent = formatCurrency(totalDebits);
    if (creditsElement) creditsElement.textContent = formatCurrency(totalCredits);
    
    // Highlight totals if they don't match
    const totalsMatch = Math.abs(totalDebits - totalCredits) < 0.01;
    if (debitsElement) debitsElement.style.color = totalsMatch ? 'inherit' : '#dc3545';
    if (creditsElement) creditsElement.style.color = totalsMatch ? 'inherit' : '#dc3545';
}

async function handleTransactionSubmit(e) {
    // Get the submit button
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    // Check if already submitting
    if (submitButton?.disabled) {
        return;
    }
    
    // Disable the submit button and show loading state
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass"></i> Saving...';
    }
    
    try {
        // Get all journal entries
        const entriesList = document.querySelector('.journal-entries-list');
        if (!entriesList) {
            throw new Error('Journal entries list not found');
        }

        const entries = [];
        const usedAccounts = new Set();
        let totalDebits = 0;
        let totalCredits = 0;

        // Validate description first
        const description = document.getElementById('transactionDescription')?.value?.trim();
        if (!description) {
            showErrorMessage('Description is required');
            return;
        }

        // Validate date
        const transactionDate = document.getElementById('transactionDate')?.value;
        if (!transactionDate) {
            showErrorMessage('Date is required');
            return;
        }

        const journalRows = entriesList.querySelectorAll('.journal-entry-row');
        if (!journalRows || journalRows.length === 0) {
            showErrorMessage('No journal entries found');
            return;
        }

        // Process all entries first to validate
        for (const row of journalRows) {
            const accountSelect = row.querySelector('.journal-entry-account');
            const debitInput = row.querySelector('.journal-entry-debit');
            const creditInput = row.querySelector('.journal-entry-credit');

            if (!accountSelect || !debitInput || !creditInput) {
                showErrorMessage('Invalid journal entry row structure');
                return;
            }

            const accountId = accountSelect.value;
            const debit = parseFloat(debitInput.value) || 0;
            const credit = parseFloat(creditInput.value) || 0;
            
            // Skip empty rows
            if (!accountId || (debit === 0 && credit === 0)) {
                continue;
            }

            // Check if account is already used
            if (usedAccounts.has(accountId)) {
                showErrorMessage('Each account can only be used once per transaction.');
                return;
            }

            // Check if trying to debit and credit same account
            if (debit > 0 && credit > 0) {
                showErrorMessage('An account cannot be both debited and credited in the same entry.');
                return;
            }

            totalDebits += debit;
            totalCredits += credit;
            usedAccounts.add(accountId);
            entries.push({
                account_id: accountId,
                debit_amount: debit,
                credit_amount: credit
            });
        }

        // Validate minimum entries
        if (entries.length < 2) {
            showErrorMessage('At least two journal entries are required');
            return;
        }

        // Validate debits = credits with small tolerance for floating point arithmetic
        if (Math.abs(totalDebits - totalCredits) >= 0.01) {
            showErrorMessage('Total debits must equal total credits');
            return;
        }

        const formData = {
            transaction_date: transactionDate,
            description: description,
            entries: entries
        };

        const result = await createTransaction(formData);
        if (result) {
            showSuccessMessage('Transaction created successfully!');
            hideTransactionForm();
            // Update local state and table immediately
            allTransactions = [result, ...allTransactions];
            updateTransactionsTable();
        }
    } catch (error) {
        console.error('Error creating transaction:', error);
        showErrorMessage('Error creating transaction: ' + error.message);
        // Refresh to get current state in case of error
        await loadTransactions();
    } finally {
        // Re-enable submit button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Save Transaction';
        }
    }
}

async function handleDeleteTransaction(id) {
    const transaction = allTransactions.find(t => t.id === id);
    if (!transaction) {
        showErrorMessage('Transaction not found');
        return;
    }

    if (await showConfirmDialog(`Are you sure you want to delete this transaction?`)) {
        try {
            const deleted = await deleteTransaction(id);
            if (deleted) {
                showSuccessMessage('Transaction deleted successfully');
                // Remove from local array immediately
                allTransactions = allTransactions.filter(t => t.id !== id);
                updateTransactionsTable();
            } else {
                // Transaction was already deleted
                showErrorMessage('Transaction was already deleted');
                // Refresh to get current state
                await loadTransactions();
            }
        } catch (error) {
            console.error('Error in handleDeleteTransaction:', error);
            showErrorMessage('Error deleting transaction: ' + error.message);
            // Refresh to get current state in case of error
            await loadTransactions();
        }
    }
}

async function applyFilters() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const accountId = document.getElementById('filterAccount').value;

    try {
        let url = `${API_URL}/transactions/`;
        const params = new URLSearchParams();
        
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (accountId) {
            params.append('account_id', accountId.toString());
            params.append('account_filter_type', 'any');
        }

        const queryString = params.toString();
        if (queryString) {
            url += '?' + queryString;
        }

        console.log('Fetching filtered transactions from:', url);
        
        const response = await fetch(url, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout(); // Redirect to login if unauthorized
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to load filtered transactions');
        }

        const data = await response.json();
        console.log('Received filtered transactions:', data);

        // Update state
        allTransactions = [...data];
        
        // Update the table with filtered results
        updateTransactionsTable(allTransactions);
        
        // Show appropriate message
        if (allTransactions.length === 0) {
            showErrorMessage('No transactions found for the selected filters');
        } else {
            showSuccessMessage('Filters applied successfully');
        }
    } catch (error) {
        console.error('Error applying filters:', error);
        if (error.message.includes('401')) {
            auth.logout(); // Redirect to login if unauthorized
        } else {
            showErrorMessage('Error applying filters: ' + error.message);
        }
    }
}

async function createTransaction(transactionData) {
    try {
        const response = await fetch(`${API_URL}/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return null;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create transaction');
        }

        const newTransaction = await response.json();
        showSuccessMessage('Transaction created successfully');
        await loadTransactions();
        return newTransaction;
    } catch (error) {
        console.error('Error creating transaction:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function deleteTransaction(id) {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
            ...auth.addAuthHeader()
        });

        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return false;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete transaction');
        }

        return true;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function viewTransaction(id) {
    try {
        // Check for existing modal instance and dispose it
        const modalElement = document.getElementById('viewTransactionModal');
        if (!modalElement) {
            throw new Error('Modal element not found');
        }

        // Get existing modal instance if any and dispose it
        const existingModal = bootstrap.Modal.getInstance(modalElement);
        if (existingModal) {
            existingModal.dispose();
        }

        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'GET',
            ...auth.addAuthHeader()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return;
            }
            throw new Error('Failed to fetch transaction details');
        }
        
        const transaction = await response.json();
        
        // Update the modal content
        const modalBody = modalElement.querySelector('.modal-body');
        modalBody.innerHTML = `
            <div class="mb-3">
                <label class="fw-bold">Date:</label>
                <div>${formatDate(transaction.transaction_date)}</div>
                </div>
            <div class="mb-3">
                <label class="fw-bold">Description:</label>
                <div>${transaction.description}</div>
            </div>
            <div class="mb-3">
                <label class="fw-bold">Entries:</label>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th class="text-end">Debit</th>
                            <th class="text-end">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transaction.journal_entries.map(entry => `
                            <tr>
                                <td>${entry.account.name}</td>
                                <td class="text-end numeric">${formatCurrency(entry.debit_amount)}</td>
                                <td class="text-end numeric">${formatCurrency(entry.credit_amount)}</td>
                                </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Create and show new modal instance
        const modal = new bootstrap.Modal(modalElement);
        
        // Add hidden event handler
        modalElement.addEventListener('hidden.bs.modal', () => {
            modal.dispose();
            // Remove modal backdrop if it exists
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            // Remove modal-open class and inline styles from body
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
        }, { once: true }); // Use once: true to ensure the listener is removed after execution

        modal.show();
    } catch (error) {
        console.error('Error viewing transaction:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

// Add this new function to validate account usage
function validateAccountUsage(changedSelect) {
    const selectedAccountId = changedSelect.value;
    if (!selectedAccountId) return;

    const allAccountSelects = document.querySelectorAll('.journal-entry-account');
    const currentRow = changedSelect.closest('.journal-entry-row');
    const currentDebit = currentRow.querySelector('.journal-entry-debit');
    const currentCredit = currentRow.querySelector('.journal-entry-credit');

    // Check if account is already used in another entry
    let isAccountUsed = false;
    allAccountSelects.forEach(select => {
        if (select.value === selectedAccountId && select !== changedSelect) {
            isAccountUsed = true;
        }
    });

    // If account is already used, show error and reset
    if (isAccountUsed) {
        showErrorMessage('This account is already used in another entry. An account can only be used once per transaction.');
        changedSelect.value = '';
        return;
    }

    // Add input event listeners to prevent debit/credit on same account
    const handleInput = () => {
        if (currentDebit.value && currentCredit.value) {
            showErrorMessage('An account cannot be both debited and credited in the same entry.');
            // Clear the most recently entered value
            if (document.activeElement === currentDebit) {
                currentDebit.value = '';
            } else {
                currentCredit.value = '';
            }
        }
    };

    // Remove any existing listeners to prevent duplicates
    currentDebit.removeEventListener('input', handleInput);
    currentCredit.removeEventListener('input', handleInput);

    // Add new listeners
    currentDebit.addEventListener('input', handleInput);
    currentCredit.addEventListener('input', handleInput);
}

// Export all functions at the end of the file
export {
    loadTransactions,
    updateTransactionsTable,
    showTransactionForm,
    hideTransactionForm,
    addJournalEntryRow,
    removeJournalEntry,
    updateTotals,
    handleTransactionSubmit,
    handleDeleteTransaction,
    applyFilters,
    createTransaction,
    deleteTransaction,
    viewTransaction,
    validateAccountUsage,
    allTransactions
};
