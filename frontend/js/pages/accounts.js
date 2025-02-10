import { loadAccounts, createAccount, updateAccount, deleteAccount } from '../modules/accounts.js';
import { updateCategoryDropdown } from '../modules/categories.js';
import { showConfirmDialog, showSuccessMessage, showErrorMessage } from '../modules/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial accounts
        await loadAccounts();

        // Set up account type change handler
        const accountType = document.getElementById('accountType');
        if (accountType) {
            accountType.addEventListener('change', () => {
                const categorySelect = document.getElementById('accountCategory');
                if (categorySelect) {
                    categorySelect.disabled = !accountType.value;
                    if (accountType.value) {
                        updateCategoryDropdown();
                    } else {
                        categorySelect.innerHTML = '<option value="">Select type first...</option>';
                    }
                }
            });
        }

        // Set up Add Account button handler
        const addButton = document.querySelector('[data-action="add-account"]');
        if (addButton) {
            addButton.addEventListener('click', () => {
                const formContainer = document.getElementById('accountForm');
                const form = document.getElementById('accountEditForm');
                if (formContainer && form) {
                    formContainer.style.display = 'block';
                    form.reset(); // Reset the actual form
                    form.dataset.editId = ''; // Clear any edit ID
                    document.getElementById('accountType').disabled = false;
                    document.getElementById('accountCategory').disabled = true;
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }

        // Set up Cancel button handler
        const cancelButton = document.querySelector('[data-action="cancel-edit"]');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                const formContainer = document.getElementById('accountForm');
                const form = document.getElementById('accountEditForm');
                if (formContainer && form) {
                    formContainer.style.display = 'none';
                    form.reset(); // Reset the actual form
                    form.dataset.editId = '';
                    document.getElementById('accountType').disabled = false;
                    document.getElementById('accountCategory').disabled = true;
                }
            });
        }

        // Set up form submission handler
        const accountForm = document.getElementById('accountEditForm');
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
                        showSuccessMessage('Account updated successfully!');
                    } else {
                        await createAccount(accountData);
                        showSuccessMessage('Account created successfully!');
                    }

                    // Reset form and hide container
                    accountForm.reset();
                    accountForm.dataset.editId = '';
                    document.getElementById('accountType').disabled = false;
                    document.getElementById('accountCategory').disabled = true;
                    document.getElementById('accountForm').style.display = 'none';

                    // Reload accounts
                    await loadAccounts();
                } catch (error) {
                    console.error('Error handling account:', error);
                    showErrorMessage('Error: ' + error.message);
                }
            });
        }

        // Set up table action handlers
        const accountsTable = document.getElementById('accountsTable');
        if (accountsTable) {
            accountsTable.addEventListener('click', async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const id = button.dataset.id;

                if (action === 'edit') {
                    // Show form and populate data
                    const formContainer = document.getElementById('accountForm');
                    const editForm = document.getElementById('accountEditForm');
                    if (formContainer && editForm) {
                        formContainer.style.display = 'block';
                        editForm.dataset.editId = id;
                        formContainer.querySelector('.card-title').textContent = 'Edit Account';
                        formContainer.querySelector('button[type="submit"]').textContent = 'Update Account';
                        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        // Populate form data
                        const accounts = await loadAccounts();
                        const account = accounts.find(a => a.id === id);
                        if (account) {
                            document.getElementById('accountName').value = account.name;
                            document.getElementById('accountType').value = account.type;
                            document.getElementById('accountType').disabled = true;
                            document.getElementById('accountCategory').value = account.category_id || '';
                            document.getElementById('accountDescription').value = account.description || '';
                            
                            // Update category dropdown
                            updateCategoryDropdown();
                            document.getElementById('accountCategory').disabled = false;
                        }
                    }
                } else if (action === 'delete') {
                    if (await showConfirmDialog('Are you sure you want to delete this account?')) {
                        try {
                            await deleteAccount(id);
                            showSuccessMessage('Account deleted successfully!');
                            await loadAccounts();
                        } catch (error) {
                            showErrorMessage('Error deleting account: ' + error.message);
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error('Error initializing accounts:', error);
        showErrorMessage('Error loading accounts. Please refresh the page.');
    }
}); 