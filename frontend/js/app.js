import { API_URL } from './modules/config.js';
import { loadAccounts, createAccount, updateAccount, deleteAccount } from './modules/accounts.js';
import { loadTransactions, addJournalEntryRow, removeJournalEntry, updateTotals, createTransaction, deleteTransaction } from './modules/transactions.js';
import { loadBalanceSheet, loadIncomeStatement, loadTrialBalance } from './modules/reports.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial data
        await Promise.all([
            loadAccounts(),
            loadTransactions(),
            loadBalanceSheet()
        ]);

        // Set up event listeners for date inputs
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput && endDateInput) {
            [startDateInput, endDateInput].forEach(input => {
                input.addEventListener('change', () => {
                    if (startDateInput.value && endDateInput.value) {
                        loadIncomeStatement(startDateInput.value, endDateInput.value);
                    }
                });
            });
        }

        // Set up event listeners for tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                showTab(tabId);
            });
        });

        // Set up event listener for new journal entry button
        const newJournalEntryBtn = document.getElementById('newJournalEntryBtn');
        if (newJournalEntryBtn) {
            newJournalEntryBtn.addEventListener('click', addJournalEntryRow);
        }

        // Set up event listener for journal entry form
        const journalEntryForm = document.getElementById('journalEntryForm');
        if (journalEntryForm) {
            journalEntryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const entries = [];
                const rows = document.querySelectorAll('.journal-entry-row');
                
                rows.forEach(row => {
                    const accountId = row.querySelector('.journal-entry-account').value;
                    const debit = parseFloat(row.querySelector('.journal-entry-debit').value) || 0;
                    const credit = parseFloat(row.querySelector('.journal-entry-credit').value) || 0;
                    
                    if (accountId && (debit > 0 || credit > 0)) {
                        entries.push({
                            account_id: accountId,
                            debit: debit,
                            credit: credit
                        });
                    }
                });
                
                const transactionData = {
                    date: document.getElementById('transactionDate').value,
                    description: document.getElementById('transactionDescription').value,
                    reference: document.getElementById('transactionReference').value,
                    entries: entries
                };
                
                try {
                    await createTransaction(transactionData);
                    journalEntryForm.reset();
                    document.querySelector('.journal-entries-list').innerHTML = '';
                    addJournalEntryRow(); // Add one empty row
                    
                    // Refresh all reports
                    await Promise.all([
                        loadBalanceSheet(),
                        loadTrialBalance(),
                        loadIncomeStatement(startDateInput.value, endDateInput.value)
                    ]);
                } catch (error) {
                    console.error('Error creating transaction:', error);
                    alert('Error creating transaction. Please check the entries and try again.');
                }
            });
        }

        // Set up event listener for new account form
        const newAccountForm = document.getElementById('newAccountForm');
        if (newAccountForm) {
            newAccountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const accountData = {
                    code: document.getElementById('accountCode').value,
                    name: document.getElementById('accountName').value,
                    type: document.getElementById('accountType').value,
                    category: document.getElementById('accountCategory').value
                };
                
                try {
                    await createAccount(accountData);
                    newAccountForm.reset();
                } catch (error) {
                    console.error('Error creating account:', error);
                    alert('Error creating account. Please try again.');
                }
            });
        }
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Error initializing application. Please refresh the page.');
    }
});

// Tab switching functionality
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabId).style.display = 'block';
    
    // Add active class to selected button
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Load tab-specific data if needed
    switch (tabId) {
        case 'accounts':
            loadAccounts();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'balanceSheet':
            loadBalanceSheet();
            break;
        case 'trialBalance':
            loadTrialBalance();
            break;
        case 'incomeStatement':
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (startDate && endDate) {
                loadIncomeStatement(startDate, endDate);
            }
            break;
    }
}

// Make functions available globally for onclick handlers
window.addJournalEntryRow = addJournalEntryRow;
window.removeJournalEntry = removeJournalEntry;
window.updateTotals = updateTotals;
window.deleteTransaction = deleteTransaction; 