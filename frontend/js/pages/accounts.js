import { loadAccounts, createAccount } from '../modules/accounts.js';
import { updateCategoryDropdown } from '../modules/categories.js';

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
                    
                    await createAccount(accountData);
                    accountForm.reset();
                    document.getElementById('accountCategory').disabled = true;
                } catch (error) {
                    console.error('Error creating account:', error);
                    alert('Error creating account: ' + error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing accounts:', error);
        alert('Error loading accounts. Please refresh the page.');
    }
}); 