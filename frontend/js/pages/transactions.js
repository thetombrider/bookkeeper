import { 
    loadTransactions, 
    addJournalEntryRow, 
    createTransaction, 
    updateTotals, 
    removeJournalEntry, 
    viewTransaction, 
    deleteTransaction 
} from '../modules/transactions.js';
import { loadAccounts } from '../modules/accounts.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial data
        await Promise.all([
            loadAccounts(),  // Need accounts for the journal entry dropdowns
            loadTransactions()
        ]);

        // Set up add journal entry button
        const addEntryBtn = document.getElementById('addEntryButton');
        if (addEntryBtn) {
            addEntryBtn.addEventListener('click', addJournalEntryRow);
        }

        // Add initial journal entry row
        addJournalEntryRow();

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

        // Set up form submission handler
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
            transactionForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
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

                    // Validate that debits equal credits
                    const totalDebits = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
                    const totalCredits = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);
                    
                    if (Math.abs(totalDebits - totalCredits) > 0.01) {
                        alert('Total debits must equal total credits');
                        return;
                    }

                    const transactionData = {
                        transaction_date: document.getElementById('transactionDate').value,
                        description: document.getElementById('transactionDescription').value,
                        entries: entries
                    };

                    await createTransaction(transactionData);
                    alert('Transaction created successfully!');
                    transactionForm.reset();
                    document.querySelector('.journal-entries-list').innerHTML = '';
                    addJournalEntryRow();
                    updateTotals();
                } catch (error) {
                    console.error('Error creating transaction:', error);
                    alert('Error creating transaction: ' + error.message);
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
                    await deleteTransaction(id);
                }
            });
        }

        // Set today's date as default for new transactions
        const dateInput = document.getElementById('transactionDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
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
    } catch (error) {
        console.error('Error initializing transactions:', error);
        alert('Error loading transactions. Please refresh the page.');
    }
});