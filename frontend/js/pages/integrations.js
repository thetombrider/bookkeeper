import { 
    loadIntegrations, 
    createIntegration, 
    updateIntegration, 
    deleteIntegration, 
    syncIntegration,
    editIntegration,
    loadConnectedBanks,
    showLoading,
    hideLoading,
    updateConfigFields
} from '../modules/integrations.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from '../modules/modal.js';
import { API_URL } from '../modules/config.js';
import { auth } from '../modules/auth.js';

// Initialize the page
async function initializePage() {
    try {
        // Check authentication
        auth.requireAuth();
        
        // Check for bank connection redirect
        const urlParams = new URLSearchParams(window.location.search);
        const sourceId = urlParams.get('source_id');
        const action = urlParams.get('action');
        
        if (sourceId && action === 'bank_connected') {
            try {
                showLoading();
                
                // Wait a bit for the bank to process the connection
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check for connected accounts
                const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-accounts`, {
                    headers: auth.addAuthHeader()
                });
                
                if (!response.ok) {
                    throw new Error('Failed to verify bank connection');
                }
                
                const accounts = await response.json();
                hideLoading();
                
                if (accounts && accounts.length > 0) {
                    showSuccessMessage('Bank connected successfully! You can now sync your transactions.');
                    // Clear URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    showErrorMessage('Bank connection was not completed. Please try again.');
                }
            } catch (error) {
                hideLoading();
                showErrorMessage('Error verifying bank connection: ' + error.message);
            }
        } else {
            // Load initial integrations
            await loadIntegrations();
        }
        
        // Set up event handlers
        setupFormHandlers();
        setupListHandlers();
    } catch (error) {
        console.error('Error initializing page:', error);
        showErrorMessage('Error loading integrations. Please refresh the page.');
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

function setupFormHandlers() {
    // Add Integration button
    const addBtn = document.querySelector('[data-action="add-integration"]');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const form = document.getElementById('integrationForm');
            const editForm = document.getElementById('integrationEditForm');
            if (form && editForm) {
                // Reset form state
                editForm.reset();
                editForm.dataset.editId = '';
                document.getElementById('integrationType').disabled = false;
                form.querySelector('.card-title').textContent = 'Add Integration';
                editForm.querySelector('button[type="submit"]').textContent = 'Create Integration';
                
                // Show form
                form.style.display = 'block';
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Integration type change handler
    const typeSelect = document.getElementById('integrationType');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            updateConfigFields(typeSelect.value);
        });
    }

    // Form submission handler
    const form = document.getElementById('integrationEditForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const formData = {
                    name: document.getElementById('integrationName').value,
                    type: document.getElementById('integrationType').value,
                    is_active: document.getElementById('integrationActive').checked,
                    config: {}
                };

                // Handle config fields based on type
                if (formData.type === 'gocardless') {
                    const secretId = document.getElementById('secretId')?.value;
                    const secretKey = document.getElementById('secretKey')?.value;
                    
                    if (!secretId || !secretKey) {
                        showErrorMessage('Both Secret ID and Secret Key are required for GoCardless integration');
                        return;
                    }
                    
                    formData.config = {
                        secretId,
                        secretKey
                    };
                } else {
                    // Handle other integration types
                    const configFields = document.querySelectorAll('#configFields input, #configFields textarea');
                    configFields.forEach(field => {
                        formData.config[field.id] = field.value;
                    });
                }

                // Add last_sync if editing
                const editId = form.dataset.editId;
                if (editId) {
                    const response = await fetch(`${API_URL}/import-sources/${editId}`, auth.addAuthHeader());
                    if (response.ok) {
                        const currentData = await response.json();
                        const currentConfig = JSON.parse(currentData.config || '{}');
                        if (currentConfig.last_sync) {
                            formData.config.last_sync = currentConfig.last_sync;
                        }
                    }
                }

                // Convert config to JSON string
                formData.config = JSON.stringify(formData.config);

                if (editId) {
                    await updateIntegration(editId, formData);
                    showSuccessMessage('Integration updated successfully');
                } else {
                    await createIntegration(formData);
                    showSuccessMessage('Integration created successfully');
                }

                // Reset and hide form
                form.reset();
                form.dataset.editId = '';
                document.getElementById('integrationType').disabled = false;
                document.getElementById('configFields').innerHTML = '';
                document.getElementById('integrationForm').style.display = 'none';

                // Reload integrations list
                await loadIntegrations();
            } catch (error) {
                console.error('Error handling integration:', error);
                showErrorMessage(error.message);
            }
        });
    }

    // Cancel button handler
    const cancelBtn = document.querySelector('[data-action="cancel-edit"]');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const form = document.getElementById('integrationEditForm');
            const formContainer = document.getElementById('integrationForm');
            if (form && formContainer) {
                form.reset();
                form.dataset.editId = '';
                document.getElementById('integrationType').disabled = false;
                document.getElementById('configFields').innerHTML = '';
                formContainer.style.display = 'none';
            }
        });
    }
}

function setupListHandlers() {
    const integrationsList = document.getElementById('integrationsList');
    if (!integrationsList) return;

    integrationsList.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        try {
            switch (action) {
                case 'edit':
                    await editIntegration(id);
                    break;
                case 'delete':
                    if (await showConfirmDialog('Are you sure you want to delete this integration?')) {
                        await deleteIntegration(id);
                    }
                    break;
                case 'sync':
                    const type = button.dataset.type;
                    await syncIntegration(id, type);
                    break;
            }
        } catch (error) {
            console.error('Error handling action:', error);
            showErrorMessage(error.message);
        }
    });
}

async function handleEdit(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, auth.addAuthHeader());
        if (!response.ok) throw new Error('Failed to fetch integration details');
        
        const integration = await response.json();
        
        // Show and populate form
        const form = document.getElementById('integrationEditForm');
        const formContainer = document.getElementById('integrationForm');
        if (form && formContainer) {
            form.dataset.editId = id;
            document.getElementById('integrationName').value = integration.name;
            
            const typeSelect = document.getElementById('integrationType');
            typeSelect.value = integration.type;
            typeSelect.disabled = true; // Disable type change when editing
            
            document.getElementById('integrationActive').checked = integration.is_active;
            
            // Update config fields for the type
            updateConfigFields(integration.type);
            
            // Populate config values
            const config = JSON.parse(integration.config || '{}');
            Object.entries(config).forEach(([key, value]) => {
                const field = document.getElementById(key);
                if (field && key !== 'last_sync') {
                    field.value = value;
                }
            });
            
            // Update form appearance
            formContainer.querySelector('.card-title').textContent = 'Edit Integration';
            form.querySelector('button[type="submit"]').textContent = 'Update Integration';
            
            // Show form
            formContainer.style.display = 'block';
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('Error editing integration:', error);
        showErrorMessage(error.message);
    }
}

async function handleDelete(id) {
    if (await showConfirmDialog('Are you sure you want to delete this integration?')) {
        await deleteIntegration(id);
    }
}

async function handleSync(id) {
    await syncIntegration(id);
} 