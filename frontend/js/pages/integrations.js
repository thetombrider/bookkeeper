import { 
    loadIntegrations, 
    createIntegration, 
    updateIntegration, 
    deleteIntegration, 
    syncIntegration,
    updateConfigFields,
    editIntegration
} from '../modules/integrations.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from '../modules/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial integrations
        await loadIntegrations();

        // Set up form handlers
        setupFormHandlers();
        
        // Set up list handlers
        setupListHandlers();

    } catch (error) {
        console.error('Error initializing integrations:', error);
        showErrorMessage('Error loading integrations. Please refresh the page.');
    }
});

function setupFormHandlers() {
    // Add Integration button
    const addBtn = document.querySelector('[data-action="add-integration"]');
    if (addBtn) {
        addBtn.onclick = () => {
            const form = document.getElementById('integrationForm');
            const editForm = document.getElementById('integrationEditForm');
            if (form && editForm) {
                // Reset form state
                editForm.reset();
                editForm.dataset.editId = '';
                document.getElementById('integrationType').disabled = false;
                document.getElementById('configFields').innerHTML = '';
                form.querySelector('.card-title').textContent = 'Add Integration';
                editForm.querySelector('button[type="submit"]').textContent = 'Create Integration';
                
                // Show form
                form.style.display = 'block';
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
    }

    // Integration type change handler
    const typeSelect = document.getElementById('integrationType');
    if (typeSelect) {
        typeSelect.onchange = () => {
            updateConfigFields(typeSelect.value);
        };
    }

    // Form submission handler
    const form = document.getElementById('integrationEditForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const formData = {
                    name: document.getElementById('integrationName').value,
                    type: document.getElementById('integrationType').value,
                    is_active: document.getElementById('integrationActive').checked,
                    config: {}
                };

                // Get config fields based on type
                const configFields = document.querySelectorAll('#configFields input');
                configFields.forEach(field => {
                    formData.config[field.id] = field.value;
                });

                // Convert config to JSON string
                formData.config = JSON.stringify(formData.config);

                const editId = form.dataset.editId;
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

            } catch (error) {
                console.error('Error handling integration:', error);
                showErrorMessage(error.message);
            }
        };
    }

    // Cancel button handler
    const cancelBtn = document.querySelector('[data-action="cancel-edit"]');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            const form = document.getElementById('integrationEditForm');
            const formContainer = document.getElementById('integrationForm');
            if (form && formContainer) {
                form.reset();
                form.dataset.editId = '';
                document.getElementById('integrationType').disabled = false;
                document.getElementById('configFields').innerHTML = '';
                formContainer.style.display = 'none';
            }
        };
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
        const response = await fetch(`${API_URL}/import-sources/${id}`);
        if (!response.ok) throw new Error('Failed to fetch integration details');
        
        const integration = await response.json();
        
        // Show and populate form
        const form = document.getElementById('integrationEditForm');
        const formContainer = document.getElementById('integrationForm');
        if (form && formContainer) {
            form.dataset.editId = id;
            document.getElementById('integrationName').value = integration.name;
            document.getElementById('integrationType').value = integration.type;
            document.getElementById('integrationActive').checked = integration.is_active;
            
            // Update config fields
            updateConfigFields(integration.type);
            
            // Populate config values
            const config = JSON.parse(integration.config || '{}');
            Object.entries(config).forEach(([key, value]) => {
                const field = document.getElementById(key);
                if (field) field.value = value;
            });
            
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