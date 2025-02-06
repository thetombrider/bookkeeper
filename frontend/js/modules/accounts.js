import { API_URL, formatCurrency } from './config.js';
import { loadCategories, updateCategoryDropdown } from './categories.js';

export let allAccounts = [];
let accountStartingBalances = new Set(); // Track accounts with starting balances

export async function loadAccounts() {
    try {
        await loadCategories();
        
        const [accountsResponse, transactionsResponse] = await Promise.all([
            fetch(`${API_URL}/accounts/`),
            fetch(`${API_URL}/transactions/`)
        ]);
        
        allAccounts = await accountsResponse.json();
        const transactions = await transactionsResponse.json();
        
        // Reset and rebuild the set of accounts with starting balances
        accountStartingBalances.clear();
        const saldiAccount = allAccounts.find(a => a.type === 'equity' && a.name === 'Saldi di Apertura');
        
        if (saldiAccount) {
            transactions.forEach(transaction => {
                if (transaction.description.startsWith('Saldo di Apertura') && 
                    transaction.journal_entries.some(entry => entry.account_id === saldiAccount.id)) {
                    // Extract the account ID from the other entry
                    const accountEntry = transaction.journal_entries.find(entry => entry.account_id !== saldiAccount.id);
                    if (accountEntry) {
                        accountStartingBalances.add(accountEntry.account_id);
                    }
                }
            });
        }
        
        updateAccountsList(allAccounts);
        return allAccounts;
    } catch (error) {
        console.error('Error loading accounts:', error);
        throw error;
    }
}

export function updateAccountsList(accounts) {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) return;
    
    // Remove existing event listeners
    const oldElement = accountsList.cloneNode(true);
    accountsList.parentNode.replaceChild(oldElement, accountsList);
    
    // Add sorting options bar
    let html = `
        <div class="sorting-options">
            <label>Group by:</label>
            <select id="accountSortOption">
                <option value="type">Account Type</option>
                <option value="category">Category</option>
            </select>
        </div>
        <div class="table-container">
            ${generateAccountsTable(accounts)}
        </div>
    `;

    oldElement.innerHTML = html;

    // Add event listeners using event delegation
    oldElement.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === 'edit') {
                await handleEditAccount(id);
            } else if (action === 'delete') {
                await handleDeleteAccount(id);
            } else if (action === 'balance') {
                await handleStartingBalance(id);
            }
        }

        // Handle category toggle
        const categoryRow = e.target.closest('tr[data-action="toggle-category"]');
        if (categoryRow) {
            const categoryId = categoryRow.dataset.category;
            const accountRows = document.querySelectorAll(`tr[data-category="${categoryId}"]`);
            const icon = categoryRow.querySelector('.toggle-icon');
            
            accountRows.forEach(row => {
                if (row !== categoryRow) {
                    row.style.display = row.style.display === 'none' ? '' : 'none';
                }
            });
            icon.textContent = icon.textContent === '▼' ? '▶' : '▼';
        }
    });

    // Add change event listener for sort option
    const sortSelect = oldElement.querySelector('#accountSortOption');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const tableHtml = generateAccountsTable(accounts);
            const tableContainer = oldElement.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.innerHTML = tableHtml;
            }
        });
    }
}

function generateAccountsTable(accounts) {
    const sortOption = document.getElementById('accountSortOption')?.value || 'type';
    
    let html = `
        <table class="accounts-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

    if (sortOption === 'type') {
        html += generateAccountsByType(accounts);
    } else {
        html += generateAccountsByCategory(accounts);
    }

    html += '</tbody></table>';
    return html;
}

function generateAccountsByType(accounts) {
    const accountsByType = {
        asset: { name: 'Assets', accounts: [] },
        liability: { name: 'Liabilities', accounts: [] },
        equity: { name: 'Equity', accounts: [] },
        income: { name: 'Income', accounts: [] },
        expense: { name: 'Expenses', accounts: [] }
    };
    
    accounts.forEach(account => {
        accountsByType[account.type].accounts.push(account);
    });

    return Object.entries(accountsByType)
        .filter(([_, typeData]) => typeData.accounts.length > 0)
        .map(([type, typeData]) => generateAccountGroup(`type-${type}`, typeData.name, typeData.accounts))
        .join('');
}

function generateAccountsByCategory(accounts) {
    const accountsByCategory = {};
    const uncategorizedAccounts = [];
    
    accounts.forEach(account => {
        if (account.category_id && account.category) {
            if (!accountsByCategory[account.category.id]) {
                accountsByCategory[account.category.id] = {
                    name: account.category.name,
                    accounts: []
                };
            }
            accountsByCategory[account.category.id].accounts.push(account);
        } else {
            uncategorizedAccounts.push(account);
        }
    });

    let html = Object.entries(accountsByCategory)
        .map(([categoryId, categoryData]) => 
            generateAccountGroup(`cat-${categoryId}`, categoryData.name, categoryData.accounts))
        .join('');

    if (uncategorizedAccounts.length > 0) {
        html += generateAccountGroup('cat-uncategorized', 'Uncategorized', uncategorizedAccounts);
    }

    return html;
}

function generateAccountGroup(groupId, groupName, accounts) {
    // Filter out Saldi di Apertura account from display if it has no entries
    const filteredAccounts = accounts.filter(account => {
        if (account.name === 'Saldi di Apertura') {
            // Only show Saldi di Apertura if it has transactions
            return accountStartingBalances.size > 0;
        }
        return true;
    });

    // If no accounts after filtering, don't render the group
    if (filteredAccounts.length === 0) {
        return '';
    }

    return `
        <tr class="category-row" data-action="toggle-category" data-category="${groupId}">
            <td colspan="5">
                <div class="category-header">
                    <span class="toggle-icon">▼</span>
                    ${groupName}
                    <span class="account-count">(${filteredAccounts.length} accounts)</span>
                </div>
            </td>
        </tr>
        ${filteredAccounts.sort((a, b) => a.code.localeCompare(b.code))
            .map(account => `
                <tr class="account-row" data-category="${groupId}">
                    <td>${account.code}</td>
                    <td>${account.name}</td>
                    <td>${account.type}</td>
                    <td>${account.description || ''}</td>
                    <td class="account-actions">
                        <button class="edit-btn" data-action="edit" data-id="${account.id}">Edit</button>
                        <button class="delete-btn" data-action="delete" data-id="${account.id}">Delete</button>
                        ${canHaveStartingBalance(account) ? 
                            `<button class="balance-btn" data-action="balance" data-id="${account.id}">Create Starting Balance</button>` 
                            : ''}
                    </td>
                </tr>
            `).join('')}
    `;
}

// Helper function to determine if an account can have a starting balance
function canHaveStartingBalance(account) {
    // Exclude Saldi di Apertura account
    if (account.name === 'Saldi di Apertura') {
        return false;
    }

    // Exclude income and expense accounts
    if (account.type === 'income' || account.type === 'expense') {
        return false;
    }

    // Check if it already has a starting balance
    if (accountStartingBalances.has(account.id)) {
        return false;
    }

    // Only assets, liabilities, and regular equity accounts can have starting balances
    return ['asset', 'liability', 'equity'].includes(account.type);
}

export async function createAccount(accountData) {
    try {
        const response = await fetch(`${API_URL}/accounts/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(accountData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || errorData.detail || 'Cannot create account.');
        }
        
        const newAccount = await response.json();
        await loadAccounts();
        return newAccount;
    } catch (error) {
        console.error('Error creating account:', error);
        throw error;
    }
}

export async function updateAccount(id, accountData) {
    try {
        const response = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(accountData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error updating account');
        }
        
        const updatedAccount = await response.json();
        await loadAccounts();
        return updatedAccount;
    } catch (error) {
        console.error('Error updating account:', error);
        throw error;
    }
}

export async function deleteAccount(id) {
    try {
        const response = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            let errorMessage;
            
            if (response.status === 404 || (data.detail && data.detail.type === 'not_found')) {
                errorMessage = 'Account not found or already deleted';
            } else if (data.detail && data.detail.message) {
                errorMessage = data.detail.message;
            } else if (data.detail) {
                errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            } else {
                errorMessage = 'Server error occurred while deleting account';
            }
            
            throw new Error(errorMessage);
        }
        
        return true;
    } catch (error) {
        console.error('Error in deleteAccount:', error);
        throw error;
    }
}

export async function getAccountBalance(accountId) {
    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/balance`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching account balance:', error);
        throw error;
    }
}

async function handleEditAccount(id) {
    const account = allAccounts.find(a => a.id === id);
    if (!account) return;

    const form = document.getElementById('accountForm');
    const nameInput = document.getElementById('accountName');
    const typeSelect = document.getElementById('accountType');
    const categorySelect = document.getElementById('accountCategory');
    const descInput = document.getElementById('accountDescription');
    const submitButton = form.querySelector('button[type="submit"]');

    if (form && nameInput && typeSelect && categorySelect && descInput && submitButton) {
        nameInput.value = account.name;
        typeSelect.value = account.type;
        typeSelect.disabled = true;
        descInput.value = account.description || '';
        
        // Enable category select
        categorySelect.disabled = false;
        
        // Trigger category dropdown update
        typeSelect.dispatchEvent(new Event('change'));
        
        // Set category after dropdown is updated
        setTimeout(() => {
            categorySelect.value = account.category_id || '';
        }, 0);

        // Update form for edit mode
        form.dataset.editId = id;
        submitButton.textContent = 'Update Account';
    }
}

async function handleDeleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account?')) {
        return;
    }

    try {
        await deleteAccount(id);
        alert('Account deleted successfully!');
        
        // Remove the account from allAccounts array
        allAccounts = allAccounts.filter(account => account.id !== id);
        
        // Update the UI with the filtered accounts
        const accountsList = document.getElementById('accountsList');
        if (accountsList) {
            updateAccountsList(allAccounts);
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.message.includes('not found') || error.message.includes('already deleted')) {
            alert('Account has already been deleted.');
            // Refresh the accounts list from server
            const response = await fetch(`${API_URL}/accounts/`);
            if (response.ok) {
                allAccounts = await response.json();
                updateAccountsList(allAccounts);
            }
        } else {
            alert('Error deleting account: ' + error.message);
        }
    }
}

async function handleStartingBalance(accountId) {
    const account = allAccounts.find(a => a.id === accountId);
    if (!account || !canHaveStartingBalance(account)) return;

    const amount = prompt(`Enter starting balance for ${account.name}:`);
    if (amount === null) return; // User cancelled

    // Parse and validate the amount
    const parsedAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
    if (isNaN(parsedAmount)) {
        alert('Please enter a valid number');
        return;
    }

    // Determine if this should be a debit or credit based on account type
    let debitAmount = 0;
    let creditAmount = 0;

    // For assets, positive balance is a debit
    // For liabilities and equity, positive balance is a credit
    if (account.type === 'asset') {
        debitAmount = parsedAmount > 0 ? Math.abs(parsedAmount) : 0;
        creditAmount = parsedAmount < 0 ? Math.abs(parsedAmount) : 0;
    } else {
        debitAmount = parsedAmount < 0 ? Math.abs(parsedAmount) : 0;
        creditAmount = parsedAmount > 0 ? Math.abs(parsedAmount) : 0;
    }

    // Find or create the "Saldi di Apertura" equity account
    let equityAccount = allAccounts.find(a => 
        a.type === 'equity' && 
        a.name === 'Saldi di Apertura'
    );

    if (!equityAccount) {
        try {
            const response = await fetch(`${API_URL}/accounts/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: 'Saldi di Apertura',
                    type: 'equity',
                    description: 'Account for opening balances'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create Saldi di Apertura account');
            }

            equityAccount = await response.json();
            allAccounts.push(equityAccount);
        } catch (error) {
            console.error('Error creating Saldi di Apertura account:', error);
            alert('Failed to create Saldi di Apertura account');
            return;
        }
    }

    try {
        const transactionData = {
            transaction_date: new Date().toISOString().split('T')[0],
            description: `Saldo di Apertura - ${account.name}`,
            entries: [
                {
                    account_id: account.id,
                    debit_amount: debitAmount,
                    credit_amount: creditAmount
                },
                {
                    account_id: equityAccount.id,
                    debit_amount: creditAmount,
                    credit_amount: debitAmount
                }
            ]
        };

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
            throw new Error(errorData.detail || 'Failed to create starting balance');
        }

        alert('Starting balance created successfully!');
        
        // Update the tracking of starting balances and refresh the UI
        accountStartingBalances.add(accountId);
        updateAccountsList(allAccounts);
    } catch (error) {
        console.error('Error creating starting balance:', error);
        alert('Error creating starting balance: ' + error.message);
    }
} 