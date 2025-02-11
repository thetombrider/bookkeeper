import { 
    loadTransactions, 
    addJournalEntryRow, 
    createTransaction, 
    updateTotals, 
    removeJournalEntry, 
    viewTransaction, 
    deleteTransaction,
    updateTransactionsTable 
} from '../modules/transactions.js';
import { loadAccounts } from '../modules/accounts.js';
import { showConfirmDialog, showSuccessMessage, showErrorMessage } from '../modules/modal.js';
import { API_URL } from '../modules/config.js';

// Global state
let allTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial data
        await Promise.all([
            loadAccounts(),  // Need accounts for the journal entry dropdowns
            loadTransactions()
        ]);

        // Set up event listeners
        setupEventListeners();

        // Set today's date as default
        const dateInput = document.getElementById('transactionDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    } catch (error) {
        console.error('Error initializing transactions:', error);
        showErrorMessage('Error loading transactions. Please refresh the page.');
    }
});

// Form handling functions
function showTransactionForm() {
    const form = document.getElementById('transactionForm');
    if (form) {
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Set today's date as default
        const dateInput = document.getElementById('transactionDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Add initial journal entry if none exist
        const entriesList = document.querySelector('.journal-entries-list');
        if (entriesList && !entriesList.children.length) {
            addJournalEntryRow();
        }
    }
}

function hideTransactionForm() {
    const form = document.getElementById('transactionForm');
    if (form) {
        form.style.display = 'none';
        const editForm = document.getElementById('transactionEditForm');
        if (editForm) {
            editForm.reset();
        }
        
        // Clear journal entries
        const entriesList = document.querySelector('.journal-entries-list');
        if (entriesList) {
            entriesList.innerHTML = '';
            addJournalEntryRow();
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
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to load filtered transactions');
        }

        const data = await response.json();
        console.log('Received filtered transactions:', data);

        // Update transactions list with filtered data
        allTransactions = [...data];
        
        // If no transactions found after filtering, show a message but don't clear the table
        if (allTransactions.length === 0) {
            showErrorMessage('No transactions found for the selected filters');
        }
        
        // Update the table with filtered results
        updateTransactionsTable();
        
        // Show success message
        showSuccessMessage('Filters applied successfully');
    } catch (error) {
        console.error('Error applying filters:', error);
        showErrorMessage('Error applying filters: ' + error.message);
    }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    // Get all journal entries
    const entries = [];
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const accountId = row.querySelector('.journal-entry-account').value;
        const debit = parseFloat(row.querySelector('.journal-entry-debit').value) || 0;
        const credit = parseFloat(row.querySelector('.journal-entry-credit').value) || 0;
        
        if (accountId && (debit > 0 || credit > 0)) {
            entries.push({
                account_id: accountId,
                debit_amount: debit,
                credit_amount: credit
            });
        }
    });

    // Validate entries
    if (entries.length < 2) {
        showErrorMessage('At least two journal entries are required');
        return;
    }

    // Calculate totals
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);

    // Validate debits = credits
    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
        showErrorMessage('Total debits must equal total credits');
        return;
    }

    const formData = {
        transaction_date: document.getElementById('transactionDate').value,
        description: document.getElementById('transactionDescription').value,
        entries: entries
    };

    try {
        await createTransaction(formData);
        showSuccessMessage('Transaction created successfully!');
        hideTransactionForm();
        await loadTransactions();
    } catch (error) {
        console.error('Error creating transaction:', error);
        showErrorMessage('Error creating transaction: ' + error.message);
    }
}

function setupEventListeners() {
    // Add Transaction button
    const addBtn = document.querySelector('[data-action="add-transaction"]');
    if (addBtn) {
        addBtn.onclick = showTransactionForm;
    }

    // Add Journal Entry button
    const addEntryBtn = document.querySelector('[data-action="add-journal-entry"]');
    if (addEntryBtn) {
        addEntryBtn.onclick = addJournalEntryRow;
    }

    // Import button
    const importBtn = document.querySelector('[data-action="import-transactions"]');
    if (importBtn) {
        importBtn.onclick = () => {
            showErrorMessage('Import functionality coming soon!');
        };
    }

    // Transaction form
    const form = document.getElementById('transactionEditForm');
    if (form) {
        form.addEventListener('submit', handleTransactionSubmit);
    }

    // Cancel button
    const cancelBtn = form?.querySelector('[data-action="cancel-edit"]');
    if (cancelBtn) {
        cancelBtn.onclick = hideTransactionForm;
    }

    // Apply filters button
    const filterBtn = document.querySelector('[data-action="apply-filters"]');
    if (filterBtn) {
        filterBtn.onclick = applyFilters;
    }

    // Set up event delegation for journal entries list
    const journalEntriesList = document.querySelector('.journal-entries-list');
    if (journalEntriesList) {
        journalEntriesList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.remove-entry');
            if (removeButton) {
                const row = removeButton.closest('.journal-entry-row');
                if (row) {
                    removeJournalEntry(row);
                }
            }
        });

        journalEntriesList.addEventListener('input', (e) => {
            const input = e.target;
            if (input.matches('.journal-entry-debit, .journal-entry-credit')) {
                updateTotals();
            }
        });
    }

    // Set up event delegation for transactions list
    const transactionsList = document.getElementById('transactionsList');
    if (transactionsList) {
        // Remove any existing event listeners by cloning and replacing
        const newTransactionsList = transactionsList.cloneNode(true);
        transactionsList.parentNode.replaceChild(newTransactionsList, transactionsList);

        // Add single event listener for all transaction actions
        newTransactionsList.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            if (action === 'view') {
                await viewTransaction(id);
            } else if (action === 'delete') {
                if (await showConfirmDialog('Are you sure you want to delete this transaction?')) {
                    await deleteTransaction(id);
                }
            }
        });
    }

    // Set up modal close handlers
    const modal = document.getElementById('transactionModal');
    const closeBtn = modal?.querySelector('.close-modal');
    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// ... rest of the file ...