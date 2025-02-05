import { API_URL, formatCurrency } from './config.js';
import { loadCategories } from './categories.js';

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
    
    // Add sorting options bar
    let html = `
        <div class="sorting-options">
            <label>Group by:</label>
            <select id="accountSortOption" onchange="updateAccountsListSort()">
                <option value="type">Account Type</option>
                <option value="category">Category</option>
            </select>
        </div>
    `;

    html += generateAccountsTable(accounts);
    accountsList.innerHTML = html;
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
        <tr class="category-row" onclick="toggleCategoryAccounts('${groupId}')">
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
                        <button onclick="editAccount('${account.id}')">Edit</button>
                        <button onclick="deleteAccount('${account.id}')">Delete</button>
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
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error deleting account');
        }
        
        await loadAccounts();
        return true;
    } catch (error) {
        console.error('Error deleting account:', error);
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