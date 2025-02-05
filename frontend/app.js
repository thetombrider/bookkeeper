/**
 * Personal Finance Bookkeeper Frontend Application
 * 
 * This file contains the main JavaScript functionality for the frontend application,
 * handling all interactions with the backend API and managing the user interface.
 */

// Configuration
const API_URL = 'http://localhost:8000';

// Update loadCategories to store categories globally
let allCategories = [];

/**
 * Navigation and Section Management
 * Handles showing/hiding different sections of the application and loading their data
 * @param {string} sectionId - ID of the section to show ('categories', 'accounts', 'transactions', 'reports')
 */
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    // Load data for the selected section
    if (sectionId === 'balance-sheet') {
        loadBalanceSheet();
    } else if (sectionId === 'income-statement') {
        loadIncomeStatement();
    } else if (sectionId === 'categories') {
        loadCategories();
    } else if (sectionId === 'accounts') {
        loadAccounts();
    } else if (sectionId === 'transactions') {
        loadAccounts().then(() => {
            loadTransactions();
        });
    }
}

/**
 * Account Categories Management
 * Functions for loading, creating, updating, and deleting account categories
 */

/**
 * Loads all account categories and updates the UI
 * - Updates the categories list table
 * - Updates category dropdowns in the accounts section
 */
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/account-categories/`);
        allCategories = await response.json();
        
        // Update categories list with table view
        const categoriesList = document.getElementById('categoriesList');
        categoriesList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allCategories.map(category => `
                        <tr>
                            <td>${category.name}</td>
                            <td>${category.description || ''}</td>
                            <td>
                                <button onclick="editCategory('${category.id}', '${category.name}', '${category.description || ''}')">Edit</button>
                                <button onclick="deleteCategory('${category.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Update category dropdown in accounts section if needed
        updateCategoryDropdown();
    } catch (error) {
        console.error('Error loading categories:', error);
        alert('Error loading categories. Please try again.');
    }
}

// Update category dropdown based on selected account type
function updateCategoryDropdown() {
    const accountType = document.getElementById('accountType').value;
    const categorySelect = document.getElementById('accountCategory');
    const isEditMode = document.getElementById('accountType').disabled;
    
    if (!accountType && !isEditMode) {
        categorySelect.disabled = true;
        categorySelect.innerHTML = '<option value="">Select account type first</option>';
        return;
    }
    
    // Show all categories regardless of type
    categorySelect.innerHTML = `
        <option value="">Select a category</option>
        ${allCategories.map(category => `
            <option value="${category.id}">${category.name}</option>
        `).join('')}
    `;
    categorySelect.disabled = false;
}

/**
 * Creates a new account category
 * @param {Event} event - Form submission event
 */
async function createCategory(event) {
    console.log('createCategory function called');
    event.preventDefault();
    
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    
    if (!nameInput || !descInput) {
        console.error('Category form elements not found');
        alert('Error: Could not create category. Please try refreshing the page.');
        return;
    }
    
    const categoryData = {
        name: nameInput.value,
        description: descInput.value
    };
    
    console.log('Creating category with data:', categoryData);
    
    try {
        console.log('Sending POST request to:', `${API_URL}/account-categories/`);
        const response = await fetch(`${API_URL}/account-categories/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });
        
        console.log('Response status:', response.status);
        
        const responseData = await response.json();
        console.log('Response data:', responseData);
        
        if (!response.ok) {
            throw new Error(responseData.detail || 'Error creating category');
        }
        
        // Clear form and reload categories
        event.target.reset();
        await loadCategories();
        
        alert('Category created successfully!');
    } catch (error) {
        console.error('Error creating category:', error);
        alert('Error creating category: ' + error.message);
    }
}

/**
 * Prepares the category form for editing an existing category
 * @param {string} id - Category ID
 * @param {string} name - Category name
 * @param {string} description - Category description
 */
function editCategory(id, name, description) {
    console.log('Edit category called:', { id, name, description });
    
    // Make sure categories section is visible
    showSection('categories');
    
    // Get form elements
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const form = document.getElementById('categoryForm');
    
    console.log('Form elements:', { 
        nameInput: nameInput ? 'found' : 'not found',
        descInput: descInput ? 'found' : 'not found',
        form: form ? 'found' : 'not found'
    });
    
    if (!nameInput || !descInput || !form) {
        console.error('Category form elements not found');
        alert('Error: Could not edit category. Please try refreshing the page.');
        return;
    }
    
    // Populate form with category data
    nameInput.value = name;
    descInput.value = description || '';
    
    // Change form submit handler to update instead of create
    form.onsubmit = (e) => updateCategory(e, id);
    
    // Update button text
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'Update Category';
    }
    
    // Add cancel button if not already present
    if (!document.getElementById('cancelEditCategory')) {
        const cancelButton = document.createElement('button');
        cancelButton.id = 'cancelEditCategory';
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = cancelEditCategory;
        submitButton.after(cancelButton);
    }
    
    console.log('Category edit form prepared successfully');
}

async function updateCategory(event, id) {
    event.preventDefault();
    
    const categoryData = {
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value
    };
    
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Reset form to create mode
        cancelEditCategory();
        
        // Reload categories
        await loadCategories();
        
        alert('Category updated successfully!');
    } catch (error) {
        console.error('Error updating category:', error);
        alert('Error updating category. Please try again.');
    }
}

function cancelEditCategory() {
    // Reset form
    document.getElementById('categoryForm').reset();
    
    // Change form submit handler back to create
    document.getElementById('categoryForm').onsubmit = createCategory;
    
    // Change button text back
    document.querySelector('#categoryForm button[type="submit"]').textContent = 'Create Category';
    
    // Remove cancel button
    const cancelButton = document.getElementById('cancelEditCategory');
    if (cancelButton) {
        cancelButton.remove();
    }
}

async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const text = await response.text();
        console.log('Raw response:', text);
        
        let data = {};
        try {
            data = JSON.parse(text);
            console.log('Parsed data:', data);
        } catch (e) {
            console.log('Failed to parse JSON:', e);
        }
        
        if (!response.ok) {
            let errorMessage = 'Error deleting category.';
            
            if (data && data.detail) {
                errorMessage = data.detail.message || data.detail || 'Cannot delete this category.';
            }
            
            alert(errorMessage);
            return;
        }
        
        // Reload categories
        await loadCategories();
        alert(data.message || 'Category deleted successfully!');
    } catch (error) {
        console.error('Network or parsing error:', error);
        alert('Error deleting category. Please check the console for details.');
    }
}

// Accounts
async function loadAccounts() {
    try {
        // First load categories to ensure they're available
        await loadCategories();
        
        const response = await fetch(`${API_URL}/accounts/`);
        const accounts = await response.json();
        allAccounts = accounts; // Store for later use
        
        // Update accounts list
        updateAccountsList(accounts);
    } catch (error) {
        console.error('Error loading accounts:', error);
        alert('Error loading accounts. Please try again.');
    }
}

function updateAccountsList(accounts) {
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

    html += `
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

    const sortOption = document.getElementById('accountSortOption')?.value || 'type';
    
    if (sortOption === 'type') {
        // Group by type
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

        // Add accounts by type
        Object.entries(accountsByType).forEach(([type, typeData]) => {
            if (typeData.accounts.length > 0) {
                html += `
                    <tr class="category-row" onclick="toggleCategoryAccounts('type-${type}')">
                        <td colspan="5">
                            <div class="category-header">
                                <span class="toggle-icon">▼</span>
                                ${typeData.name}
                                <span class="account-count">(${typeData.accounts.length} accounts)</span>
                            </div>
                        </td>
                    </tr>`;

                typeData.accounts.sort((a, b) => a.code.localeCompare(b.code)).forEach(account => {
                    html += `
                        <tr class="account-row" data-category="type-${type}">
                            <td>${account.code}</td>
                            <td>${account.name}</td>
                            <td>${account.type}</td>
                            <td>${account.description || ''}</td>
                            <td class="account-actions">
                                <button onclick="editAccount('${account.id}')">Edit</button>
                                <button onclick="deleteAccount('${account.id}')">Delete</button>
                                <button onclick="showOpeningBalanceDialog('${account.id}', '${account.name}')">Set Opening Balance</button>
                            </td>
                        </tr>`;
                });
            }
        });
    } else {
        // Group by category
        const accountsByCategory = {};
        const uncategorizedAccounts = [];
        
        accounts.forEach(account => {
            if (account.category_id) {
                const category = allCategories.find(c => c.id === account.category_id);
                if (category) {
                    if (!accountsByCategory[category.id]) {
                        accountsByCategory[category.id] = {
                            name: category.name,
                            accounts: []
                        };
                    }
                    accountsByCategory[category.id].accounts.push(account);
                } else {
                    uncategorizedAccounts.push(account);
                }
            } else {
                uncategorizedAccounts.push(account);
            }
        });

        // Add categorized accounts
        Object.entries(accountsByCategory).forEach(([categoryId, categoryData]) => {
            html += `
                <tr class="category-row" onclick="toggleCategoryAccounts('cat-${categoryId}')">
                    <td colspan="5">
                        <div class="category-header">
                            <span class="toggle-icon">▼</span>
                            ${categoryData.name}
                            <span class="account-count">(${categoryData.accounts.length} accounts)</span>
                        </div>
                    </td>
                </tr>`;

            categoryData.accounts.sort((a, b) => a.code.localeCompare(b.code)).forEach(account => {
                html += `
                    <tr class="account-row" data-category="cat-${categoryId}">
                        <td>${account.code}</td>
                        <td>${account.name}</td>
                        <td>${account.type}</td>
                        <td>${account.description || ''}</td>
                        <td class="account-actions">
                            <button onclick="editAccount('${account.id}')">Edit</button>
                            <button onclick="deleteAccount('${account.id}')">Delete</button>
                            <button onclick="showOpeningBalanceDialog('${account.id}', '${account.name}')">Set Opening Balance</button>
                        </td>
                    </tr>`;
            });
        });

        // Add uncategorized accounts
        if (uncategorizedAccounts.length > 0) {
            html += `
                <tr class="category-row" onclick="toggleCategoryAccounts('cat-uncategorized')">
                    <td colspan="5">
                        <div class="category-header">
                            <span class="toggle-icon">▼</span>
                            Uncategorized
                            <span class="account-count">(${uncategorizedAccounts.length} accounts)</span>
                        </div>
                    </td>
                </tr>`;

            uncategorizedAccounts.sort((a, b) => a.code.localeCompare(b.code)).forEach(account => {
                html += `
                    <tr class="account-row" data-category="cat-uncategorized">
                        <td>${account.code}</td>
                        <td>${account.name}</td>
                        <td>${account.type}</td>
                        <td>${account.description || ''}</td>
                        <td class="account-actions">
                            <button onclick="editAccount('${account.id}')">Edit</button>
                            <button onclick="deleteAccount('${account.id}')">Delete</button>
                            <button onclick="showOpeningBalanceDialog('${account.id}', '${account.name}')">Set Opening Balance</button>
                        </td>
                    </tr>`;
            });
        }
    }

    html += `
            </tbody>
        </table>`;
    
    accountsList.innerHTML = html;
}

// Function to handle sorting option change
function updateAccountsListSort() {
    updateAccountsList(allAccounts);
}

// Update the toggle function to work with type-based categories
function toggleCategoryAccounts(type) {
    const rows = document.querySelectorAll(`.account-row[data-category="${type}"]`);
    const header = document.querySelector(`tr.category-row[onclick*="${type}"]`);
    const icon = header.querySelector('.toggle-icon');
    
    rows.forEach(row => {
        row.style.display = row.style.display === 'none' ? '' : 'none';
    });
    
    icon.textContent = icon.textContent === '▼' ? '▶' : '▼';
}

async function createAccount(event) {
    event.preventDefault();
    
    const accountData = {
        category_id: document.getElementById('accountCategory').value || null,
        name: document.getElementById('accountName').value,
        type: document.getElementById('accountType').value,
        description: document.getElementById('accountDescription').value,
        is_active: true
    };
    
    try {
        const response = await fetch(`${API_URL}/accounts/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(accountData)
        });
        
        const text = await response.text();
        console.log('Raw response:', text);
        
        let data = {};
        try {
            data = JSON.parse(text);
            console.log('Parsed data:', data);
        } catch (e) {
            console.log('Failed to parse JSON:', e);
        }
        
        if (!response.ok) {
            let errorMessage = 'Error creating account.';
            
            if (data && data.detail) {
                errorMessage = data.detail.message || data.detail || 'Cannot create account.';
            }
            
            alert(errorMessage);
            return;
        }
        
        // Clear form
        event.target.reset();
        
        // Reload accounts
        loadAccounts();
        
        alert(`Account created successfully with code: ${data.code}`);
    } catch (error) {
        console.error('Network or parsing error:', error);
        alert('Error creating account. Please check the console for details.');
    }
}

async function viewBalance(accountId) {
    try {
        const response = await fetch(`${API_URL}/accounts/${accountId}/balance`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const balance = await response.json();
        alert(`Current Balance: ${balance}`);
    } catch (error) {
        console.error('Error fetching account balance:', error);
        alert('Error fetching account balance. Please try again.');
    }
}

async function editAccount(id) {
    try {
        // Make sure accounts section is visible
        showSection('accounts');
        
        // Fetch account details
        const response = await fetch(`${API_URL}/accounts/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const account = await response.json();
        
        // Wait for categories to load
        await loadCategories();
        
        // Disable account type change as it would invalidate the account code
        document.getElementById('accountType').disabled = true;
        
        // Populate form with account data
        document.getElementById('accountType').value = account.type;
        document.getElementById('accountName').value = account.name;
        document.getElementById('accountDescription').value = account.description || '';
        
        // Update and enable category selection
        updateCategoryDropdown();
        document.getElementById('accountCategory').value = account.category_id || '';
        
        // Change form submit handler
        const form = document.getElementById('accountForm');
        form.onsubmit = (e) => updateAccount(e, id);
        
        // Change button text
        form.querySelector('button[type="submit"]').textContent = 'Update Account';
        
        // Add cancel button if it doesn't exist
        if (!document.getElementById('cancelEditAccount')) {
            const cancelButton = document.createElement('button');
            cancelButton.id = 'cancelEditAccount';
            cancelButton.type = 'button';
            cancelButton.textContent = 'Cancel';
            cancelButton.onclick = cancelEditAccount;
            form.querySelector('button[type="submit"]').after(cancelButton);
        }
    } catch (error) {
        console.error('Error fetching account details:', error);
        alert('Error fetching account details. Please try again.');
    }
}

// Add force reload utility function
async function forceReload() {
    // Clear any cached data
    allAccounts = [];
    allCategories = [];
    
    // Force browser to reload page without cache
    window.location.reload(true);
}

async function updateAccount(event, id) {
    event.preventDefault();
    
    const accountData = {
        category_id: document.getElementById('accountCategory').value || null,
        name: document.getElementById('accountName').value,
        type: document.getElementById('accountType').value,
        description: document.getElementById('accountDescription').value,
        is_active: true
    };
    
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
        
        // Reset form to create mode
        cancelEditAccount();
        
        // Force reload to clear cache
        forceReload();
        
        alert('Account updated successfully!');
    } catch (error) {
        console.error('Error updating account:', error);
        alert('Error updating account: ' + error.message);
    }
}

function cancelEditAccount() {
    // Reset form
    document.getElementById('accountForm').reset();
    
    // Re-enable account type selection
    document.getElementById('accountType').disabled = false;
    
    // Change form submit handler back to create
    document.getElementById('accountForm').onsubmit = createAccount;
    
    // Change button text back
    document.querySelector('#accountForm button[type="submit"]').textContent = 'Create Account';
    
    // Remove cancel button
    const cancelButton = document.getElementById('cancelEditAccount');
    if (cancelButton) {
        cancelButton.remove();
    }
}

async function deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account?')) {
        return;
    }
    
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
        
        // Force reload to clear cache
        forceReload();
        
        alert('Account deleted successfully!');
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account: ' + error.message);
    }
}

// Transactions
async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions/`);
        const transactions = await response.json();
        
        // Update transactions list
        const transactionsList = document.getElementById('transactionsList');
        transactionsList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(transaction => `
                        <tr>
                            <td>${transaction.transaction_date}</td>
                            <td>${transaction.description}</td>
                            <td>${transaction.reference_number || ''}</td>
                            <td>${transaction.status}</td>
                            <td>
                                <button onclick="viewTransaction('${transaction.id}')">View</button>
                                <button onclick="deleteTransaction('${transaction.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading transactions:', error);
        alert('Error loading transactions. Please try again.');
    }
}

async function addJournalEntryRow() {
    // Ensure accounts are loaded
    if (!allAccounts || allAccounts.length === 0) {
        await loadAccounts();
    }

    const entriesList = document.querySelector('.journal-entries-list');
    const newRow = document.createElement('div');
    newRow.className = 'journal-entry-row';
    newRow.innerHTML = `
        <select class="journal-entry-account" required>
            <option value="">Select an account</option>
            ${allAccounts.map(account => `
                <option value="${account.id}">${account.code} - ${account.name}</option>
            `).join('')}
        </select>
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-debit" 
               onchange="updateTotals()">
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-credit" 
               onchange="updateTotals()">
        <button type="button" onclick="removeJournalEntry(this)" title="Remove entry">
            <span>×</span>
        </button>
    `;
    
    entriesList.appendChild(newRow);
    updateTotals();
}

function removeJournalEntry(button) {
    button.closest('.journal-entry-row').remove();
    updateTotals();
}

function updateTotals() {
    let totalDebits = 0;
    let totalCredits = 0;
    
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const debit = parseDecimalNumber(row.querySelector('.journal-entry-debit').value) || 0;
        const credit = parseDecimalNumber(row.querySelector('.journal-entry-credit').value) || 0;
        
        totalDebits += debit;
        totalCredits += credit;
    });
    
    document.getElementById('total-debits').textContent = formatCurrency(totalDebits);
    document.getElementById('total-credits').textContent = formatCurrency(totalCredits);
    
    // Highlight totals if they don't match
    const totalsMatch = Math.abs(totalDebits - totalCredits) < 0.01;
    document.getElementById('total-debits').style.color = totalsMatch ? '#333' : '#dc3545';
    document.getElementById('total-credits').style.color = totalsMatch ? '#333' : '#dc3545';
}

// Helper function to parse decimal numbers
function parseDecimalNumber(value) {
    if (!value) return 0;
    // Remove any thousand separators and normalize decimal separator to dot
    const normalized = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
}

async function createTransaction(event) {
    event.preventDefault();
    
    // Gather journal entries
    const entries = [];
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const accountId = row.querySelector('.journal-entry-account').value;
        const debitAmount = parseDecimalNumber(row.querySelector('.journal-entry-debit').value);
        const creditAmount = parseDecimalNumber(row.querySelector('.journal-entry-credit').value);
        
        if (accountId && (debitAmount > 0 || creditAmount > 0)) {
            entries.push({
                account_id: accountId,
                debit_amount: debitAmount,
                credit_amount: creditAmount
            });
        }
    });
    
    // Validate entries
    if (entries.length < 2) {
        alert('Please add at least two journal entries.');
        return;
    }
    
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debit_amount, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.credit_amount, 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
        alert('Total debits must equal total credits.');
        return;
    }
    
    const transactionData = {
        transaction_date: document.getElementById('transactionDate').value,
        description: document.getElementById('transactionDescription').value,
        entries: entries
    };
    
    try {
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
            throw new Error(errorData.detail || 'Error creating transaction');
        }
        
        const result = await response.json();
        
        // Clear form
        event.target.reset();
        document.querySelector('.journal-entries-list').innerHTML = '';
        
        // Reload transactions
        loadTransactions();
        
        alert(`Transaction created successfully!\nReference Number: ${result.reference_number}`);
    } catch (error) {
        console.error('Error creating transaction:', error);
        alert(error.message || 'Error creating transaction. Please try again.');
    }
}

async function viewTransaction(id) {
    try {
        console.log('Fetching transaction:', id);
        const response = await fetch(`${API_URL}/transactions/${id}`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const transaction = await response.json();
        console.log('Raw transaction data:', transaction);
        
        // Calculate totals
        const totalDebits = transaction.journal_entries.reduce((sum, entry) => sum + Number(entry.debit_amount), 0);
        const totalCredits = transaction.journal_entries.reduce((sum, entry) => sum + Number(entry.credit_amount), 0);
        
        // Format the transaction details
        const details = `
Transaction Details:
------------------
Date: ${transaction.transaction_date}
Description: ${transaction.description}
Reference: ${transaction.reference_number || 'N/A'}
Status: ${transaction.status}

Journal Entries:
--------------
${transaction.journal_entries.map(entry => {
    console.log('Raw entry data:', entry);
    console.log('Account data:', entry.account);
    
    let accountInfo;
    if (entry.account) {
        console.log('Account code:', entry.account.code);
        console.log('Account name:', entry.account.name);
        accountInfo = `${entry.account.code} - ${entry.account.name}`;
    } else {
        console.warn('No account object found for entry:', entry);
        accountInfo = `Missing Account Information (ID: ${entry.account_id})`;
    }
    
    return `
Account: ${accountInfo}
Debit: ${formatCurrency(entry.debit_amount)}
Credit: ${formatCurrency(entry.credit_amount)}`;
}).join('\n')}

Summary:
-------
Total Debits: ${formatCurrency(totalDebits)}
Total Credits: ${formatCurrency(totalCredits)}`;
        
        console.log('Final formatted details:', details);
        alert(details);
    } catch (error) {
        console.error('Error in viewTransaction:', error);
        console.error('Error stack:', error.stack);
        alert('Error fetching transaction details: ' + error.message);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Reload transactions
        loadTransactions();
        
        alert('Transaction deleted successfully!');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction. Please try again.');
    }
}

// Reports
async function generateBalanceSheet() {
    const asOfDate = document.getElementById('balanceSheetDate').value;
    try {
        const url = new URL(`${API_URL}/balance-sheet/`);
        if (asOfDate) {
            url.searchParams.append('as_of', asOfDate);
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display balance sheet
        document.getElementById('balanceSheetReport').innerHTML = `
            <h4>Balance Sheet ${asOfDate ? `as of ${asOfDate}` : '(Current)'}</h4>
            
            <h5>Assets</h5>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.assets.map(asset => `
                        <tr>
                            <td>${asset.name}</td>
                            <td class="text-right">${formatCurrency(asset.balance)}</td>
                        </tr>
                    `).join('')}
                    <tr class="text-total">
                        <td>Total Assets</td>
                        <td class="text-right">${formatCurrency(data.total_assets)}</td>
                    </tr>
                </tbody>
            </table>
            
            <h5>Liabilities</h5>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.liabilities.map(liability => `
                        <tr>
                            <td>${liability.name}</td>
                            <td class="text-right">${formatCurrency(liability.balance)}</td>
                        </tr>
                    `).join('')}
                    <tr class="text-total">
                        <td>Total Liabilities</td>
                        <td class="text-right">${formatCurrency(data.total_liabilities)}</td>
                    </tr>
                </tbody>
            </table>
            
            <h5>Equity</h5>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.equity.map(equity => `
                        <tr>
                            <td>${equity.name}</td>
                            <td class="text-right">${formatCurrency(equity.balance)}</td>
                        </tr>
                    `).join('')}
                    <tr class="text-total">
                        <td>Total Equity</td>
                        <td class="text-right">${formatCurrency(data.total_equity)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error generating balance sheet:', error);
        alert('Error generating balance sheet. Please try again.');
    }
}

async function generateIncomeStatement() {
    const startDate = document.getElementById('incomeStartDate').value;
    const endDate = document.getElementById('incomeEndDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }
    
    try {
        const url = new URL(`${API_URL}/income-statement/`);
        url.searchParams.append('start_date', startDate);
        url.searchParams.append('end_date', endDate);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display income statement
        document.getElementById('incomeStatementReport').innerHTML = `
            <h4>Income Statement (${startDate} to ${endDate})</h4>
            
            <h5>Income</h5>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.income.map(income => `
                        <tr>
                            <td>${income.name}</td>
                            <td class="text-right">${formatCurrency(income.balance)}</td>
                        </tr>
                    `).join('')}
                    <tr class="text-total">
                        <td>Total Income</td>
                        <td class="text-right">${formatCurrency(data.total_income)}</td>
                    </tr>
                </tbody>
            </table>
            
            <h5>Expenses</h5>
            <table>
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.expenses.map(expense => `
                        <tr>
                            <td>${expense.name}</td>
                            <td class="text-right">${formatCurrency(expense.balance)}</td>
                        </tr>
                    `).join('')}
                    <tr class="text-total">
                        <td>Total Expenses</td>
                        <td class="text-right">${formatCurrency(data.total_expenses)}</td>
                    </tr>
                </tbody>
            </table>
            
            <h5>Summary</h5>
            <table>
                <tbody>
                    <tr class="text-total">
                        <td>Net Income</td>
                        <td class="text-right">${formatCurrency(data.net_income)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error generating income statement:', error);
        alert('Error generating income statement. Please try again.');
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// Add this new function for closing the books
async function closeBooks(year) {
    try {
        // First, ensure we have a Retained Earnings account
        let retainedEarningsAccount = allAccounts.find(
            acc => acc.type === 'equity' && acc.name === 'Utili Portati a Nuovo'
        );

        // If not, create it
        if (!retainedEarningsAccount) {
            const response = await fetch(`${API_URL}/accounts/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'Utili Portati a Nuovo',
                    type: 'equity',
                    description: 'Utili accumulati dalle operazioni precedenti'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create Retained Earnings account');
            }

            retainedEarningsAccount = await response.json();
        }

        // Create closing entries
        const transactionData = {
            transaction_date: `${year}-12-31`,
            description: `Closing entries for ${year}`,
            entries: []
        };

        // Get all income and expense accounts with their balances
        const accounts = await fetch(`${API_URL}/accounts/`).then(r => r.json());
        const balances = await fetch(`${API_URL}/accounts/balances/`).then(r => r.json());

        const incomeAccounts = accounts.filter(acc => acc.type === 'income');
        const expenseAccounts = accounts.filter(acc => acc.type === 'expense');

        // Close income accounts (credit balances)
        incomeAccounts.forEach(account => {
            const balance = Math.abs(Number(balances[account.id] || 0));
            if (balance > 0) {
                transactionData.entries.push(
                    {
                        account_id: account.id,
                        debit_amount: balance,
                        credit_amount: 0
                    }
                );
            }
        });

        // Close expense accounts (debit balances)
        expenseAccounts.forEach(account => {
            const balance = Math.abs(Number(balances[account.id] || 0));
            if (balance > 0) {
                transactionData.entries.push(
                    {
                        account_id: account.id,
                        debit_amount: 0,
                        credit_amount: balance
                    }
                );
            }
        });

        // Calculate net income/loss
        const totalIncome = incomeAccounts.reduce((sum, account) => 
            sum + Math.abs(Number(balances[account.id] || 0)), 0);
        const totalExpenses = expenseAccounts.reduce((sum, account) => 
            sum + Math.abs(Number(balances[account.id] || 0)), 0);
        const netIncome = totalIncome - totalExpenses;

        // Add retained earnings entry
        if (netIncome !== 0) {
            if (netIncome > 0) {
                // Net income - credit Retained Earnings
                transactionData.entries.push({
                    account_id: retainedEarningsAccount.id,
                    debit_amount: 0,
                    credit_amount: netIncome
                });
            } else {
                // Net loss - debit Retained Earnings
                transactionData.entries.push({
                    account_id: retainedEarningsAccount.id,
                    debit_amount: Math.abs(netIncome),
                    credit_amount: 0
                });
            }
        }

        // Create the closing transaction
        if (transactionData.entries.length > 0) {
            const response = await fetch(`${API_URL}/transactions/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });

            if (!response.ok) {
                throw new Error('Failed to create closing entries');
            }

            alert(`Successfully closed books for ${year}`);
            await loadDashboard();
        } else {
            alert('No entries to close');
        }
    } catch (error) {
        console.error('Error closing books:', error);
        alert('Error closing books: ' + error.message);
    }
}

// Update loadDashboard function to use the actual Retained Earnings account
async function loadDashboard() {
    try {
        // Fetch accounts with their balances
        const accountsResponse = await fetch(`${API_URL}/accounts/`);
        const accounts = await accountsResponse.json();
        
        // Fetch balances for all accounts
        const balancesResponse = await fetch(`${API_URL}/accounts/balances/`);
        const balances = await balancesResponse.json();
        
        // Initialize sections
        const sections = {
            asset: { title: 'Assets', accounts: [], total: 0 },
            liability: { title: 'Liabilities', accounts: [], total: 0 },
            equity: { title: 'Equity', accounts: [], total: 0 }
        };
        
        // First pass: organize regular accounts
        accounts.forEach(account => {
            if (sections[account.type]) {
                const balance = Number(balances[account.id] || 0);
                // For all accounts, use absolute values and handle signs consistently
                const displayBalance = Math.abs(balance);
                sections[account.type].accounts.push({
                    ...account,
                    balance: displayBalance
                });
                sections[account.type].total += displayBalance;
            }
        });

        // Calculate net income (current year earnings)
        const incomeAccounts = accounts.filter(a => a.type === 'income');
        const expenseAccounts = accounts.filter(a => a.type === 'expense');
        
        let totalIncome = 0;
        let totalExpenses = 0;
        
        incomeAccounts.forEach(account => {
            const balance = Number(balances[account.id] || 0);
            // Income accounts have credit balance (negative)
            totalIncome += -balance;  // Negate the negative balance to get positive income
        });
        
        expenseAccounts.forEach(account => {
            const balance = Number(balances[account.id] || 0);
            // Expense accounts have debit balance (positive)
            totalExpenses += balance;  // Keep positive expense
        });
        
        // Net income = income - expenses
        const netIncome = totalIncome - totalExpenses;

        // Add net income to equity section
        if (netIncome !== 0) {
            sections.equity.accounts.push({
                name: 'Utili di esercizio',
                balance: Math.abs(netIncome)
            });
            sections.equity.total += netIncome;  // Add the actual value (positive or negative) to total
        }

        // Generate HTML
        let html = '<div class="balance-sheet">';
        
        // Assets Column
        html += '<div class="balance-sheet-column">';
        html += '<h3>Assets</h3>';
        html += '<table>';
        sections.asset.accounts.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Assets</td>
            <td class="text-right">${formatCurrency(sections.asset.total)}</td>
        </tr>`;
        html += '</table>';
        html += '</div>';
        
        // Liabilities and Equity Column
        html += '<div class="balance-sheet-column">';
        
        // Liabilities Section
        html += '<h3>Liabilities</h3>';
        html += '<table>';
        sections.liability.accounts.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Liabilities</td>
            <td class="text-right">${formatCurrency(sections.liability.total)}</td>
        </tr>`;
        html += '</table>';
        
        // Equity Section
        html += '<h3>Equity</h3>';
        html += '<table>';
        sections.equity.accounts.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });

        // Add current year earnings
        if (netIncome !== 0) {
            html += `<tr>
                <td>Utili di esercizio</td>
                <td class="text-right">${formatCurrency(netIncome)}</td>
            </tr>`;
        }

        html += `<tr class="total-row">
            <td>Total Equity</td>
            <td class="text-right">${formatCurrency(sections.equity.total)}</td>
        </tr>`;

        // Total Liabilities and Equity
        const totalLiabilitiesAndEquity = sections.liability.total + sections.equity.total;
        html += `<tr class="grand-total-row">
            <td>Total Liabilities and Equity</td>
            <td class="text-right">${formatCurrency(totalLiabilitiesAndEquity)}</td>
        </tr>`;
        html += '</table>';
        
        html += '</div>';
        html += '</div>';
        
        document.getElementById('accountsTable').innerHTML = html;
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard. Please try again.');
    }
}

// Helper function to generate income statement table HTML
function generateIncomeStatementTable(data) {
    let html = '<div class="income-statement">';
    
    // Income section
    html += '<div class="statement-section">';
    html += '<h3>Income</h3>';
    html += '<table>';
    data.income.forEach(item => {
        html += `<tr>
            <td>${item.name}</td>
            <td class="balance">${formatCurrency(item.balance)}</td>
        </tr>`;
    });
    html += `<tr class="total-row">
        <td>Total Income</td>
        <td class="balance">${formatCurrency(data.total_income)}</td>
    </tr>`;
    html += '</table>';
    html += '</div>';
    
    // Expenses section
    html += '<div class="statement-section">';
    html += '<h3>Expenses</h3>';
    html += '<table>';
    data.expenses.forEach(item => {
        html += `<tr>
            <td>${item.name}</td>
            <td class="balance">${formatCurrency(item.balance)}</td>
        </tr>`;
    });
    html += `<tr class="total-row">
        <td>Total Expenses</td>
        <td class="balance">${formatCurrency(data.total_expenses)}</td>
    </tr>`;
    html += '</table>';
    html += '</div>';
    
    // Net Income
    html += `<div class="net-income">
        <strong>Net Income:</strong>
        <span class="balance ${data.net_income >= 0 ? 'balance-positive' : 'balance-negative'}">
            ${formatCurrency(data.net_income)}
        </span>
    </div>`;
    
    html += '</div>';
    return html;
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show dashboard section by default
    showSection('dashboard');
});

// Function to load balance sheet
async function loadBalanceSheet() {
    try {
        const dateInput = document.getElementById('balanceSheetDate');
        const asOfDate = dateInput.value || new Date().toISOString().split('T')[0];
        dateInput.value = asOfDate;

        // Fetch balance sheet data from backend
        const response = await fetch(`${API_URL}/balance-sheet/?as_of=${asOfDate}`);
        if (!response.ok) {
            throw new Error('Failed to fetch balance sheet data');
        }
        const data = await response.json();

        // Generate HTML using the data from backend
        let html = '<div class="balance-sheet">';
        
        // Assets Column
        html += '<div class="balance-sheet-column">';
        html += '<h3>Assets</h3>';
        html += '<table>';
        data.assets.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Assets</td>
            <td class="text-right">${formatCurrency(data.total_assets)}</td>
        </tr>`;
        html += '</table>';
        html += '</div>';
        
        // Liabilities and Equity Column
        html += '<div class="balance-sheet-column">';
        
        // Liabilities Section
        html += '<h3>Liabilities</h3>';
        html += '<table>';
        data.liabilities.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Liabilities</td>
            <td class="text-right">${formatCurrency(data.total_liabilities)}</td>
        </tr>`;
        html += '</table>';
        
        // Equity Section
        html += '<h3>Equity</h3>';
        html += '<table>';
        data.equity.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${formatCurrency(account.balance)}</td>
            </tr>`;
        });

        // Add net income if it's not zero
        if (data.net_income !== 0) {
            html += `<tr>
                <td>Utili di esercizio</td>
                <td class="text-right">${formatCurrency(data.net_income)}</td>
            </tr>`;
        }

        html += `<tr class="total-row">
            <td>Total Equity</td>
            <td class="text-right">${formatCurrency(data.total_equity)}</td>
        </tr>`;

        // Add Total Liabilities and Equity as the last row of the equity table
        html += `<tr class="grand-total-row">
            <td>Total Liabilities and Equity</td>
            <td class="text-right">${formatCurrency(data.total_liabilities + data.total_equity)}</td>
        </tr>`;
        html += '</table>';
        
        html += '</div>';
        html += '</div>';

        document.getElementById('accountsTable').innerHTML = html;
    } catch (error) {
        console.error('Error loading balance sheet:', error);
        alert('Error loading balance sheet. Please try again.');
    }
}

// Function to load income statement
async function loadIncomeStatement() {
    try {
        const startDate = document.getElementById('incomeStartDate').value;
        const endDate = document.getElementById('incomeEndDate').value;

        if (!startDate || !endDate) {
            // Set default dates if not selected (current month)
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            document.getElementById('incomeStartDate').value = firstDay.toISOString().split('T')[0];
            document.getElementById('incomeEndDate').value = lastDay.toISOString().split('T')[0];
            return loadIncomeStatement(); // Retry with default dates
        }

        // Fetch accounts with their balances
        const accountsResponse = await fetch(`${API_URL}/accounts/`);
        const accounts = await accountsResponse.json();
        
        // Fetch balances for the period
        const balancesResponse = await fetch(`${API_URL}/accounts/balances/?as_of=${endDate}`);
        const balances = await balancesResponse.json();
        
        // Filter and calculate income and expenses
        const incomeAccounts = accounts.filter(a => a.type === 'income');
        const expenseAccounts = accounts.filter(a => a.type === 'expense');
        
        let totalIncome = 0;
        const incomeDetails = [];
        incomeAccounts.forEach(account => {
            const balance = Number(balances[account.id] || 0);
            const amount = -balance;  // Convert credit balance to positive income
            if (amount !== 0) {
                incomeDetails.push({
                    name: account.name,
                    balance: amount
                });
                totalIncome += amount;
            }
        });
        
        let totalExpenses = 0;
        const expenseDetails = [];
        expenseAccounts.forEach(account => {
            const balance = Number(balances[account.id] || 0);
            if (balance !== 0) {
                expenseDetails.push({
                    name: account.name,
                    balance: balance
                });
                totalExpenses += balance;
            }
        });
        
        const netIncome = totalIncome - totalExpenses;
        
        // Generate HTML
        const html = generateIncomeStatementTable({
            income: incomeDetails,
            expenses: expenseDetails,
            total_income: totalIncome,
            total_expenses: totalExpenses,
            net_income: netIncome
        });
        
        document.getElementById('incomeStatementTable').innerHTML = html;
    } catch (error) {
        console.error('Error loading income statement:', error);
        alert('Error loading income statement. Please try again.');
    }
}