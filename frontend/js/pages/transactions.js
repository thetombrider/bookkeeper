import { loadTransactions, addJournalEntryRow, createTransaction, updateTotals } from '../modules/transactions.js';
import { loadAccounts } from '../modules/accounts.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial data
        await Promise.all([
            loadAccounts(),  // Need accounts for the journal entry dropdowns
            loadTransactions()
        ]);

        // Set up add journal entry button
        const addEntryBtn = document.querySelector('[data-action="add-journal-entry"]');
        if (addEntryBtn) {
            addEntryBtn.addEventListener('click', addJournalEntryRow);
        }

        // Add initial journal entry row
        addJournalEntryRow();

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

                    const transactionData = {
                        transaction_date: document.getElementById('transactionDate').value,
                        description: document.getElementById('transactionDescription').value,
                        entries: entries
                    };

                    await createTransaction(transactionData);
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
    } catch (error) {
        console.error('Error initializing transactions:', error);
        alert('Error loading transactions. Please refresh the page.');
    }
});