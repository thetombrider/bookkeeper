import { loadAccounts, createAccount, updateAccount } from '../modules/accounts.js';
import { updateCategoryDropdown } from '../modules/categories.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial accounts
        await loadAccounts();

        // Set up account type change handler
        const accountTypeSelect = document.getElementById('accountType');
        if (accountTypeSelect) {
            // Remove any existing event listeners by cloning and replacing
            const newAccountTypeSelect = accountTypeSelect.cloneNode(true);
            accountTypeSelect.parentNode.replaceChild(newAccountTypeSelect, accountTypeSelect);
            newAccountTypeSelect.addEventListener('change', updateCategoryDropdown);
        }

        // Set up form submission handler
        const accountForm = document.getElementById('accountForm');
        if (accountForm) {
            // Remove any existing event listeners by cloning and replacing
            const newAccountForm = accountForm.cloneNode(true);
            accountForm.parentNode.replaceChild(newAccountForm, accountForm);
            
            newAccountForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const accountData = {
                        name: document.getElementById('accountName').value,
                        type: document.getElementById('accountType').value,
                        category_id: document.getElementById('accountCategory').value || null,
                        description: document.getElementById('accountDescription').value
                    };
                    
                    const editId = newAccountForm.dataset.editId;
                    if (editId) {
                        await updateAccount(editId, accountData);
                        alert('Account updated successfully!');
                        newAccountForm.dataset.editId = ''; // Clear edit mode
                        document.querySelector('button[type="submit"]').textContent = 'Create Account';
                    } else {
                        await createAccount(accountData);
                        alert('Account created successfully!');
                    }
                    
                    newAccountForm.reset();
                    document.getElementById('accountCategory').disabled = true;
                    document.getElementById('accountType').disabled = false;
                } catch (error) {
                    console.error('Error handling account:', error);
                    alert('Error: ' + error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing accounts:', error);
        alert('Error loading accounts. Please refresh the page.');
    }
}); 