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
    // Hide all sections first
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show the selected section
    const selectedSection = document.getElementById(sectionId);
    selectedSection.classList.remove('hidden');
    
    // Load appropriate data based on the section
    switch(sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'categories':
            loadCategories();
            // Re-attach event handlers for the category form
            const categoryForm = document.getElementById('categoryForm');
            if (categoryForm) {
                categoryForm.onsubmit = createCategory;
            }
            break;
        case 'accounts':
            loadCategories(); // Categories needed for account creation dropdown
            loadAccounts();
            // Re-attach event handlers for the account form
            const accountForm = document.getElementById('accountForm');
            if (accountForm) {
                accountForm.onsubmit = createAccount;
            }
            break;
        case 'transactions':
            loadAccounts(); // Accounts needed for transaction entry dropdowns
            loadTransactions();
            break;
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
        const response = await fetch(`${API_URL}/accounts/`);
        const accounts = await response.json();
        allAccounts = accounts; // Store for later use
        
        // Update accounts list
        const accountsList = document.getElementById('accountsList');
        accountsList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${accounts.map(account => `
                        <tr>
                            <td>${account.code}</td>
                            <td>${account.name}</td>
                            <td>${account.type}</td>
                            <td>${account.category ? account.category.name : 'Uncategorized'}</td>
                            <td>${account.description || ''}</td>
                            <td>
                                <button onclick="editAccount('${account.id}')">Edit</button>
                                <button onclick="deleteAccount('${account.id}')">Delete</button>
                                <button onclick="viewBalance('${account.id}')">Balance</button>
                                ${(account.type === 'asset' || account.type === 'liability') ? 
                                    `<button onclick="showOpeningBalanceDialog('${account.id}', '${account.name}')">Set Opening Balance</button>` 
                                    : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Update account dropdowns in transactions section
        updateAccountDropdowns(accounts);
    } catch (error) {
        console.error('Error loading accounts:', error);
        alert('Error loading accounts. Please try again.');
    }
}

// Helper function to update account dropdowns
function updateAccountDropdowns(accounts) {
    const accountSelects = document.querySelectorAll('.journal-entry-account');
    accountSelects.forEach(select => {
        select.innerHTML = `
            <option value="">Select an account</option>
            ${accounts.map(account => `
                <option value="${account.id}">${account.code} - ${account.name}</option>
            `).join('')}
        `;
    });
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
            let errorMessage = 'Error updating account.';
            
            if (data && data.detail) {
                errorMessage = data.detail.message || data.detail || 'Cannot update account.';
            }
            
            alert(errorMessage);
            return;
        }
        
        // Reset form to create mode
        cancelEditAccount();
        
        // Reload accounts
        loadAccounts();
        
        alert('Account updated successfully!');
    } catch (error) {
        console.error('Network or parsing error:', error);
        alert('Error updating account. Please check the console for details.');
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
            let errorMessage = 'Error deleting account.';
            
            if (data && data.detail) {
                errorMessage = data.detail.message || data.detail || 'Cannot delete this account.';
            }
            
            alert(errorMessage);
            return;
        }
        
        // Reload accounts
        loadAccounts();
        alert(data.message || 'Account deleted successfully!');
    } catch (error) {
        console.error('Network or parsing error:', error);
        alert('Error deleting account. Please check the console for details.');
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

function addJournalEntryRow() {
    const entriesList = document.querySelector('.journal-entries-list');
    const newRow = document.createElement('div');
    newRow.className = 'journal-entry-row';
    newRow.innerHTML = `
        <select class="journal-entry-account" required>
            <option value="">Select an account</option>
        </select>
        <input type="number" step="0.01" placeholder="Debit amount" class="journal-entry-debit">
        <input type="number" step="0.01" placeholder="Credit amount" class="journal-entry-credit">
        <button type="button" onclick="this.parentElement.remove()">Remove</button>
    `;
    
    // Populate account options
    loadAccounts().then(() => {
        const select = newRow.querySelector('.journal-entry-account');
        const accounts = Array.from(document.querySelectorAll('#accountsList tr')).slice(1); // Skip header row
        select.innerHTML = `
            <option value="">Select an account</option>
            ${accounts.map(row => {
                const code = row.cells[0].textContent;
                const name = row.cells[1].textContent;
                const id = row.querySelector('button').onclick.toString().match(/'([^']+)'/)[1];
                return `<option value="${id}">${code} - ${name}</option>`;
            }).join('')}
        `;
    });
    
    entriesList.appendChild(newRow);
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
        
        // Separate accounts by type
        const assets = accounts.filter(account => account.type === 'asset')
            .sort((a, b) => a.code.localeCompare(b.code));
        const liabilities = accounts.filter(account => account.type === 'liability')
            .sort((a, b) => a.code.localeCompare(b.code));
        const equity = accounts.filter(account => account.type === 'equity')
            .sort((a, b) => a.code.localeCompare(b.code));
        const income = accounts.filter(account => account.type === 'income')
            .sort((a, b) => a.code.localeCompare(b.code));
        const expenses = accounts.filter(account => account.type === 'expense')
            .sort((a, b) => a.code.localeCompare(b.code));
        
        // Calculate totals
        const totalAssets = assets.reduce((sum, account) => {
            const balance = Number(balances[account.id] || 0);
            return sum + balance;
        }, 0);

        const totalLiabilities = liabilities.reduce((sum, account) => {
            const balance = Number(balances[account.id] || 0);
            return sum + Math.abs(balance);
        }, 0);

        // Calculate current period's income and expenses
        const totalIncome = income.reduce((sum, account) => {
            const balance = Number(balances[account.id] || 0);
            return sum + Math.abs(balance);
        }, 0);

        const totalExpenses = expenses.reduce((sum, account) => {
            const balance = Number(balances[account.id] || 0);
            return sum + Math.abs(balance);
        }, 0);

        // Find Retained Earnings account if it exists
        const retainedEarningsAccount = equity.find(account => account.name === 'Utili Portati a Nuovo');
        const previousRetainedEarnings = retainedEarningsAccount ? 
            Math.abs(Number(balances[retainedEarningsAccount.id] || 0)) : 0;

        // Current period's net income/loss
        const currentPeriodEarnings = totalIncome - totalExpenses;

        // Total equity is sum of:
        // 1. Regular equity accounts (excluding Retained Earnings)
        // 2. Previously closed Retained Earnings (if any)
        // 3. Current period's earnings
        const regularEquity = equity.reduce((sum, account) => {
            if (account.name !== 'Utili Portati a Nuovo') {
                const balance = Number(balances[account.id] || 0);
                return sum + Math.abs(balance);
            }
            return sum;
        }, 0);

        const totalEquity = regularEquity + previousRetainedEarnings + currentPeriodEarnings;
        
        // Create the HTML for the balance sheet
        const accountsTable = document.getElementById('accountsTable');
        accountsTable.innerHTML = `
            <div class="balance-sheet">
                <div class="balance-sheet-column">
                    <h3>Assets</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th class="text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assets.map(account => {
                                const balance = Number(balances[account.id] || 0);
                                return `
                                    <tr>
                                        <td>${account.name}</td>
                                        <td class="balance text-right">${formatCurrency(Math.abs(balance))}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr class="total-row">
                                <td><strong>Total Assets</strong></td>
                                <td class="balance text-right"><strong>${formatCurrency(Math.abs(totalAssets))}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="balance-sheet-column">
                    <h3>Liabilities</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th class="text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${liabilities.map(account => {
                                const balance = Number(balances[account.id] || 0);
                                return `
                                    <tr>
                                        <td>${account.name}</td>
                                        <td class="balance text-right">${formatCurrency(Math.abs(balance))}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr class="total-row">
                                <td><strong>Total Liabilities</strong></td>
                                <td class="balance text-right"><strong>${formatCurrency(totalLiabilities)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <h3>Equity</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th class="text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${equity.filter(account => account.name !== 'Utili Portati a Nuovo').map(account => {
                                const balance = Number(balances[account.id] || 0);
                                return `
                                    <tr>
                                        <td>${account.name}</td>
                                        <td class="balance text-right">${formatCurrency(Math.abs(balance))}</td>
                                    </tr>
                                `;
                            }).join('')}
                            ${retainedEarningsAccount ? `
                                <tr>
                                    <td>Utili Esercizi Precedenti</td>
                                    <td class="balance text-right">${formatCurrency(previousRetainedEarnings)}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td>Utile (Perdita) d'Esercizio</td>
                                <td class="balance text-right">${formatCurrency(currentPeriodEarnings)}</td>
                            </tr>
                            <tr class="total-row">
                                <td><strong>Total Equity</strong></td>
                                <td class="balance text-right"><strong>${formatCurrency(totalEquity)}</strong></td>
                            </tr>
                            <tr class="grand-total-row">
                                <td><strong>Total Liabilities & Equity</strong></td>
                                <td class="balance text-right"><strong>${formatCurrency(totalLiabilities + totalEquity)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Add a button to close the books if we're in December
        const currentMonth = new Date().getMonth();
        if (currentMonth === 11) { // December
            const currentYear = new Date().getFullYear();
            accountsTable.insertAdjacentHTML('beforeend', `
                <div class="closing-section">
                    <button onclick="closeBooks(${currentYear})">Close Books for ${currentYear}</button>
                </div>
            `);
        }

        // Verify accounting equation
        const difference = Math.abs(Math.abs(totalAssets) - (totalLiabilities + totalEquity));
        if (difference > 0.01) {  // Allow for small rounding differences
            console.warn('Warning: Accounting equation is not balanced!', {
                totalAssets: Math.abs(totalAssets),
                totalLiabilities,
                totalEquity,
                difference
            });
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard. Please try again.');
    }
}

/**
 * Creates an opening balance transaction for an account
 * @param {string} accountId - The account ID to set balance for
 * @param {number} amount - The opening balance amount (positive for assets, negative for liabilities)
 * @param {string} openingBalanceAccountId - The opening balance equity account ID
 */
async function createOpeningBalance(accountId, amount, openingBalanceAccountId) {
    const transactionData = {
        transaction_date: new Date().toISOString().split('T')[0],
        description: 'Saldo di Apertura',
        entries: []
    };

    // Get the account type
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
        throw new Error('Account not found');
    }

    // For assets: positive amount means debit (increase)
    // For liabilities: positive amount means credit (increase)
    if (account.type === 'asset') {
        if (amount > 0) {
            // Debit asset, credit opening balance equity
            transactionData.entries = [
                {
                    account_id: accountId,
                    debit_amount: amount,
                    credit_amount: 0
                },
                {
                    account_id: openingBalanceAccountId,
                    debit_amount: 0,
                    credit_amount: amount
                }
            ];
        } else {
            // Credit asset, debit opening balance equity (negative balance)
            const absAmount = Math.abs(amount);
            transactionData.entries = [
                {
                    account_id: accountId,
                    debit_amount: 0,
                    credit_amount: absAmount
                },
                {
                    account_id: openingBalanceAccountId,
                    debit_amount: absAmount,
                    credit_amount: 0
                }
            ];
        }
    } else if (account.type === 'liability') {
        if (amount > 0) {
            // Credit liability, debit opening balance equity (positive balance = more liability)
            transactionData.entries = [
                {
                    account_id: accountId,
                    debit_amount: 0,
                    credit_amount: amount
                },
                {
                    account_id: openingBalanceAccountId,
                    debit_amount: amount,
                    credit_amount: 0
                }
            ];
        } else {
            // Debit liability, credit opening balance equity (negative balance = less liability)
            const absAmount = Math.abs(amount);
            transactionData.entries = [
                {
                    account_id: accountId,
                    debit_amount: absAmount,
                    credit_amount: 0
                },
                {
                    account_id: openingBalanceAccountId,
                    debit_amount: 0,
                    credit_amount: absAmount
                }
            ];
        }
    }

    try {
        const response = await fetch(`${API_URL}/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error creating opening balance');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating opening balance:', error);
        throw error;
    }
}

/**
 * Shows the opening balance dialog for an account
 * @param {string} accountId - The account ID to set balance for
 * @param {string} accountName - The account name
 */
async function showOpeningBalanceDialog(accountId, accountName) {
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
        alert('Account not found');
        return;
    }

    let message;
    if (account.type === 'asset') {
        message = `Enter opening balance for ${accountName}:\nPositive number for debit balance (normal)\nNegative number for credit balance\nUse either dot (.) or comma (,) as decimal separator`;
    } else if (account.type === 'liability') {
        message = `Enter opening balance for ${accountName}:\nPositive number for credit balance (normal)\nNegative number for debit balance\nUse either dot (.) or comma (,) as decimal separator`;
    }
    
    const amount = prompt(message);
    
    if (amount === null) return; // User cancelled
    
    const numAmount = parseDecimalNumber(amount);
    if (isNaN(numAmount)) {
        alert('Please enter a valid number');
        return;
    }

    try {
        // First, check if we have an opening balance equity account
        let openingBalanceAccount = allAccounts.find(
            acc => acc.type === 'equity' && acc.name === 'Saldi di Apertura'
        );

        // If not, create it
        if (!openingBalanceAccount) {
            const response = await fetch(`${API_URL}/accounts/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'Saldi di Apertura',
                    type: 'equity',
                    description: 'Saldi di apertura dei conti patrimoniali'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create opening balance account');
            }

            openingBalanceAccount = await response.json();
        }

        // Create the opening balance transaction
        await createOpeningBalance(accountId, numAmount, openingBalanceAccount.id);
        
        alert('Opening balance set successfully!');
        
        // Refresh the accounts list and balances
        await loadAccounts();
        if (document.getElementById('dashboard').classList.contains('hidden') === false) {
            await loadDashboard();
        }
    } catch (error) {
        console.error('Error setting opening balance:', error);
        alert('Error setting opening balance: ' + error.message);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show dashboard section by default
    showSection('dashboard');
});