import { API_URL, formatCurrency } from './config.js';
import { loadCategories, updateCategoryDropdown } from './categories.js';
import { showConfirmDialog, showSuccessMessage, showErrorMessage, showFormModal } from './modal.js';
import { auth } from './auth.js';

// State
let allAccounts = [];
let accountStartingBalances = new Set(); // Track accounts with starting balances

// Functions
async function loadAccounts() {
    try {
        // Check authentication first
        if (!auth.requireAuth()) {
            return [];
        }

        const response = await fetch(`${API_URL}/accounts/`, {
            method: 'GET',
            ...auth.addAuthHeader()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return [];
            }
            throw new Error('Failed to load accounts');
        }
        
        const data = await response.json();
        allAccounts = [...data];
        
        // Update accounts list if the element exists
        const accountsList = document.getElementById('accountsList');
        if (accountsList) {
            updateAccountsList(allAccounts);
        }
        
        return data;
    } catch (error) {
        console.error('Error loading accounts:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        showErrorMessage('Error loading accounts: ' + error.message);
        return [];
    }
}

function updateAccountsList(accounts) {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) return;
    
    // Remove existing event listeners
    const oldElement = accountsList.cloneNode(true);
    accountsList.parentNode.replaceChild(oldElement, accountsList);
    
    // Add sorting options bar
    let html = `
        <div class="d-flex justify-content-between align-items-center p-3 bg-light border-bottom">
            <div class="d-flex align-items-center gap-2">
                <label class="form-label mb-0">Group by:</label>
                <select id="accountSortOption" class="form-select form-select-sm" style="width: auto;">
                    <option value="type">Account Type</option>
                    <option value="category">Category</option>
                </select>
            </div>
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
            const icon = categoryRow.querySelector('.bi');
            
            accountRows.forEach(row => {
                if (row !== categoryRow) {
                    row.style.display = row.style.display === 'none' ? '' : 'none';
                }
            });
            icon.classList.toggle('bi-chevron-down');
            icon.classList.toggle('bi-chevron-right');
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
        <table class="table table-hover mb-0">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th class="text-end">Balance</th>
                    <th class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>`;

    if (accounts.length === 0) {
        html += `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No accounts found. Click "Add Account" to create one.
                </td>
            </tr>`;
    } else {
        html += sortOption === 'type' ? generateAccountsByType(accounts) : generateAccountsByCategory(accounts);
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
        <tr class="table-light" data-action="toggle-category" data-category="${groupId}" style="cursor: pointer;">
            <td colspan="6">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-chevron-down"></i>
                    <strong>${groupName}</strong>
                    <span class="text-muted ms-2">(${filteredAccounts.length} accounts)</span>
                </div>
            </td>
        </tr>
        ${filteredAccounts.map(account => `
            <tr data-category="${groupId}">
                <td>${account.name}</td>
                <td>${account.category ? account.category.name : '-'}</td>
                <td>${account.type.charAt(0).toUpperCase() + account.type.slice(1)}</td>
                <td>${account.description || '-'}</td>
                <td class="text-end numeric">${formatCurrency(0)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${account.id}">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${account.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
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

async function createAccount(accountData) {
    try {
        const response = await fetch(`${API_URL}/accounts/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(accountData)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return null;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || errorData.detail || 'Cannot create account.');
        }
        
        const newAccount = await response.json();
        await loadAccounts();
        return newAccount;
    } catch (error) {
        console.error('Error creating account:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function updateAccount(id, accountData) {
    try {
        const response = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(accountData)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return null;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Cannot update account.');
        }
        
        const updatedAccount = await response.json();
        await loadAccounts();
        return updatedAccount;
    } catch (error) {
        console.error('Error updating account:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function deleteAccount(id) {
    try {
        const response = await fetch(`${API_URL}/accounts/${id}`, {
            method: 'DELETE',
            ...auth.addAuthHeader()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return false;
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Cannot delete account.');
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function getAccountBalance(accountId) {
    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/balance`, {
            method: 'GET',
            ...auth.addAuthHeader()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return null;
            }
            throw new Error('Failed to get account balance');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting account balance:', error);
        if (error.message.includes('401')) {
            auth.logout();
        }
        throw error;
    }
}

async function handleEditAccount(id) {
    const account = allAccounts.find(a => a.id === id);
    if (!account) return;

    const form = document.getElementById('accountEditForm');
    const formContainer = document.getElementById('accountForm');
    const nameInput = document.getElementById('accountName');
    const typeSelect = document.getElementById('accountType');
    const categorySelect = document.getElementById('accountCategory');
    const descInput = document.getElementById('accountDescription');
    const submitButton = form?.querySelector('button[type="submit"]');
    const existingCancelButton = form?.querySelector('[data-action="cancel-edit"]');

    if (form && formContainer && nameInput && typeSelect && categorySelect && descInput && submitButton) {
        // Show the form container
        formContainer.style.display = 'block';
        
        // Add editing indicator to form title
        const formTitle = formContainer.querySelector('.card-title');
        if (formTitle) {
            formTitle.textContent = `Edit Account: ${account.name}`;
        }
        
        // Scroll to form with smooth animation
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Fill form with account data
        nameInput.value = account.name;
        typeSelect.value = account.type;
        typeSelect.disabled = true; // Disable type selection in edit mode
        descInput.value = account.description || '';
        
        // First enable and update category dropdown
        categorySelect.disabled = false;
        updateCategoryDropdown();
        
        // Then set the category value
        setTimeout(() => {
            categorySelect.value = account.category_id || '';
        }, 0);

        // Update form for edit mode
        form.dataset.editId = id;
        submitButton.textContent = 'Update Account';

        // Update the existing cancel button's behavior
        if (existingCancelButton) {
            existingCancelButton.onclick = () => {
                form.reset();
                form.dataset.editId = '';
                formContainer.style.display = 'none';
                formTitle.textContent = 'Add Account';
                submitButton.textContent = 'Create Account';
                typeSelect.disabled = false;
                categorySelect.disabled = true;
            };
        }
    } else {
        console.error('Required form elements not found');
        showErrorMessage('Error: Could not load edit form. Please try again.');
    }
}

async function handleDeleteAccount(id) {
    const account = allAccounts.find(a => a.id === id);
    if (!account) return;

    if (await showConfirmDialog(`Are you sure you want to delete the account "${account.name}"?`)) {
        try {
            await deleteAccount(id);
            showSuccessMessage('Account deleted successfully!');
            
            // Remove the account from allAccounts array
            allAccounts = allAccounts.filter(account => account.id !== id);
            
            // Update the UI with the filtered accounts
            const accountsList = document.getElementById('accountsList');
            if (accountsList) {
                updateAccountsList(allAccounts);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showErrorMessage('Error deleting account: ' + error.message);
        }
    }
}

async function handleStartingBalance(accountId) {
    const account = allAccounts.find(a => a.id === accountId);
    if (!account) return;

    const content = `
        <div class="form-group">
            <label for="startingBalance">Starting Balance for ${account.name}:</label>
            <input type="number" id="startingBalance" class="form-control" step="0.01" required>
        </div>
    `;

    showFormModal('Create Starting Balance', content, async () => {
        const balanceInput = document.getElementById('startingBalance');
        const balance = parseFloat(balanceInput.value);
        
        if (isNaN(balance)) {
            showErrorMessage('Please enter a valid number for the starting balance.');
            return false;
        }

        try {
            // Create starting balance transaction
            const transactionData = {
                transaction_date: new Date().toISOString().split('T')[0],
                description: `Saldo di Apertura - ${account.name}`,
                entries: [
                    {
                        account_id: accountId,
                        debit_amount: balance > 0 ? Math.abs(balance) : 0,
                        credit_amount: balance < 0 ? Math.abs(balance) : 0
                    },
                    {
                        account_id: allAccounts.find(a => a.name === 'Saldi di Apertura')?.id,
                        debit_amount: balance < 0 ? Math.abs(balance) : 0,
                        credit_amount: balance > 0 ? Math.abs(balance) : 0
                    }
                ]
            };

            const response = await fetch(`${API_URL}/transactions/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error creating starting balance');
            }

            showSuccessMessage('Starting balance created successfully!');
            await loadAccounts(); // Reload to update UI
            return true;
        } catch (error) {
            console.error('Error creating starting balance:', error);
            showErrorMessage('Error creating starting balance: ' + error.message);
            return false;
        }
    });
}

// Export all functions at the end of the file
export {
    loadAccounts,
    updateAccountsList,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccountBalance,
    handleEditAccount,
    handleDeleteAccount,
    handleStartingBalance,
    allAccounts
}; 