import { API_URL, formatCurrency } from './config.js';
import { loadCategories, updateCategoryDropdown } from './categories.js';

export let allAccounts = [];

export async function loadAccounts() {
    try {
        // First load categories to ensure they're available
        await loadCategories();
        
        const response = await fetch(`${API_URL}/accounts/`);
        allAccounts = await response.json();
        
        // Update accounts list
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
    `;

    html += generateAccountsTable(accounts);
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
            const tableContainer = oldElement.querySelector('table')?.parentElement;
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
    return `
        <tr class="category-row" data-action="toggle-category" data-category="${groupId}">
            <td colspan="5">
                <div class="category-header">
                    <span class="toggle-icon">▼</span>
                    ${groupName}
                    <span class="account-count">(${accounts.length} accounts)</span>
                </div>
            </td>
        </tr>
        ${accounts.sort((a, b) => a.code.localeCompare(b.code))
            .map(account => `
                <tr class="account-row" data-category="${groupId}">
                    <td>${account.code}</td>
                    <td>${account.name}</td>
                    <td>${account.type}</td>
                    <td>${account.description || ''}</td>
                    <td class="account-actions">
                        <button class="edit-btn" data-action="edit" data-id="${account.id}">Edit</button>
                        <button class="delete-btn" data-action="delete" data-id="${account.id}">Delete</button>
                    </td>
                </tr>
            `).join('')}
    `;
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