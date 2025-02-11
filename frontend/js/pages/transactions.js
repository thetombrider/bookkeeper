import { 
    loadTransactions, 
    addJournalEntryRow, 
    createTransaction, 
    updateTotals, 
    removeJournalEntry, 
    viewTransaction, 
    deleteTransaction,
    updateTransactionsTable,
    showTransactionForm,
    hideTransactionForm,
    handleTransactionSubmit,
    validateAccountUsage
} from '../modules/transactions.js';
import { loadAccounts } from '../modules/accounts.js';
import { showErrorMessage, showSuccessMessage, showConfirmDialog } from '../modules/modal.js';
import { API_URL } from '../modules/config.js';

let allTransactions = [];

// Initialize the page
async function initializePage() {
    try {
        // Load initial data
        await Promise.all([
            loadAccounts(),
            loadTransactions()
        ]);

        // Set today's date as default
        const dateInput = document.getElementById('transactionDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Set up event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing transactions page:', error);
        showErrorMessage('Error loading transactions. Please refresh the page.');
    }
}

// Initialize on both DOMContentLoaded and app-ready
window.addEventListener('DOMContentLoaded', initializePage);
window.addEventListener('app-ready', initializePage);

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

function setupEventListeners() {
    // Add Transaction button
    const addBtn = document.querySelector('[data-action="add-transaction"]');
    if (addBtn) {
        addBtn.onclick = () => {
            showTransactionForm();
            // Set today's date as default
            const dateInput = document.getElementById('transactionDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        };
    }

    // Add Journal Entry button
    const addEntryBtn = document.querySelector('[data-action="add-journal-entry"]');
    if (addEntryBtn) {
        addEntryBtn.onclick = (e) => {
            e.preventDefault();
            addJournalEntryRow();
        };
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
        // Add submit listener with debounce
        let isSubmitting = false;
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            
            try {
                await handleTransactionSubmit(e);
            } finally {
                isSubmitting = false;
            }
        };
    }

    // Cancel button
    const cancelBtn = form?.querySelector('[data-action="cancel-edit"]');
    if (cancelBtn) {
        cancelBtn.onclick = hideTransactionForm;
    }

    // Journal entries list - handle remove entry and account changes
    const journalEntriesList = document.querySelector('.journal-entries-list');
    if (journalEntriesList) {
        journalEntriesList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-entry"]');
            if (removeBtn) {
                const row = removeBtn.closest('.journal-entry-row');
                if (row) {
                    removeJournalEntry(row);
                }
            }
        });

        // Add change event listener for account selects
        journalEntriesList.addEventListener('change', (e) => {
            if (e.target.classList.contains('journal-entry-account')) {
                validateAccountUsage(e.target);
            }
        });
    }

    // Table actions
    const tbody = document.querySelector('#transactionsTable tbody');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            if (action === 'view') {
                await viewTransaction(id);
            } else if (action === 'delete') {
                if (await showConfirmDialog('Are you sure you want to delete this transaction?')) {
                    try {
                        await deleteTransaction(id);
                        showSuccessMessage('Transaction deleted successfully');
                        await loadTransactions();
                    } catch (error) {
                        showErrorMessage('Error deleting transaction: ' + error.message);
                    }
                }
            }
        });
    }

    // Apply filters button
    const filterBtn = document.querySelector('[data-action="apply-filters"]');
    if (filterBtn) {
        filterBtn.onclick = applyFilters;
    }
}

// ... rest of the file ...