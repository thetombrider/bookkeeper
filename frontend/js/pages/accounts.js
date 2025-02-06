import { loadAccounts, createAccount, updateAccount } from '../modules/accounts.js';
import { updateCategoryDropdown } from '../modules/categories.js';
import { showSuccessMessage, showErrorMessage } from '../modules/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial accounts
        await loadAccounts();

        // Set up account type change handler
        const accountTypeSelect = document.getElementById('accountType');
        if (accountTypeSelect) {
            accountTypeSelect.addEventListener('change', updateCategoryDropdown);
        }

        // Set up form submission handler
        const accountForm = document.getElementById('accountForm');
        if (accountForm) {
            accountForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const accountData = {
                        name: document.getElementById('accountName').value,
                        type: document.getElementById('accountType').value,
                        category_id: document.getElementById('accountCategory').value || null,
                        description: document.getElementById('accountDescription').value
                    };
                    
                    const editId = accountForm.dataset.editId;
                    if (editId) {
                        await updateAccount(editId, accountData);
                        
                        // Reset form styling and state
                        const formContainer = document.querySelector('.form-container');
                        const formTitle = formContainer.querySelector('h3');
                        const submitButton = accountForm.querySelector('button[type="submit"]');
                        const cancelButton = accountForm.querySelector('.cancel-edit-btn');
                        const typeSelect = document.getElementById('accountType');
                        const categorySelect = document.getElementById('accountCategory');
                        
                        // Update visual state
                        formContainer.classList.remove('editing');
                        formTitle.textContent = 'Create Account';
                        submitButton.textContent = 'Create Account';
                        
                        // Remove cancel button
                        if (cancelButton) {
                            cancelButton.remove();
                        }
                        
                        // Reset form state
                        accountForm.dataset.editId = '';
                        accountForm.reset();
                        
                        // Reset select elements
                        typeSelect.disabled = false;
                        categorySelect.disabled = true;
                        
                        showSuccessMessage('Account updated successfully!');
                    } else {
                        await createAccount(accountData);
                        accountForm.reset();
                        document.getElementById('accountCategory').disabled = true;
                        showSuccessMessage('Account created successfully!');
                    }
                } catch (error) {
                    console.error('Error handling account:', error);
                    showErrorMessage('Error: ' + error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing accounts:', error);
        showErrorMessage('Error loading accounts. Please refresh the page.');
    }
}); 