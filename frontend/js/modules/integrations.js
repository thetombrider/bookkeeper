import { API_URL } from './config.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from './modal.js';
import { auth } from './auth.js';

// State
let allIntegrations = [];

// Loading state functions
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Functions
async function loadIntegrations() {
    try {
        const response = await fetch(`${API_URL}/import-sources/`, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return [];
            }
            throw new Error('Failed to load integrations');
        }
        allIntegrations = await response.json();
        
        // Update integrations list if the element exists
        const integrationsList = document.getElementById('integrationsList');
        if (integrationsList) {
            updateIntegrationsList(allIntegrations);
        }
        
        return allIntegrations;
    } catch (error) {
        console.error('Error loading integrations:', error);
        if (error.message.includes('401')) {
            auth.logout();
            return [];
        }
        showErrorMessage('Error loading integrations: ' + error.message);
        return [];
    }
}

function updateIntegrationsList(integrations) {
    const list = document.getElementById('integrationsList');
    if (!list) return;

    if (!integrations || integrations.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">
                    No integrations found
                </td>
            </tr>
        `;
        return;
    }

    list.innerHTML = integrations.map(integration => `
        <tr>
            <td>${integration.name}</td>
            <td>${integration.type}</td>
            <td>${integration.status}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-2" 
                        data-action="edit" 
                        data-id="${integration.id}"
                        data-name="${integration.name}"
                        data-type="${integration.type}"
                        data-status="${integration.status}">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" 
                        data-action="delete" 
                        data-id="${integration.id}">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function createIntegration(formData) {
    try {
        const response = await fetch(`${API_URL}/import-sources/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create integration');
        }

        const newIntegration = await response.json();
        showSuccessMessage('Integration created successfully');
        await loadIntegrations();
        return newIntegration;
    } catch (error) {
        console.error('Error creating integration:', error);
        throw error;
    }
}

async function updateIntegration(id, formData) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update integration');
        }

        const updatedIntegration = await response.json();
        showSuccessMessage('Integration updated successfully');
        await loadIntegrations();
        return updatedIntegration;
    } catch (error) {
        console.error('Error updating integration:', error);
        throw error;
    }
}

async function deleteIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'DELETE',
            ...auth.addAuthHeader()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete integration');
        }

        showSuccessMessage('Integration deleted successfully');
        await loadIntegrations();
        return true;
    } catch (error) {
        console.error('Error deleting integration:', error);
        throw error;
    }
}

async function handleEditIntegration(id, name, type, status) {
    const form = document.getElementById('integrationForm');
    if (!form) return;

    form.dataset.editId = id;
    document.getElementById('integrationName').value = name;
    document.getElementById('integrationType').value = type;
    document.getElementById('integrationStatus').value = status;

    // Update form appearance
    const formContainer = form.closest('.card');
    const formTitle = formContainer.querySelector('.card-title');
    const submitButton = form.querySelector('button[type="submit"]');
    
    formContainer.classList.add('editing');
    formTitle.textContent = 'Edit Integration';
    submitButton.textContent = 'Update Integration';

    // Add cancel button if it doesn't exist
    if (!form.querySelector('.cancel-edit-btn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary me-2 cancel-edit-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            form.reset();
            form.dataset.editId = '';
            formContainer.classList.remove('editing');
            formTitle.textContent = 'Create Integration';
            submitButton.textContent = 'Create Integration';
            cancelBtn.remove();
        };
        submitButton.parentNode.insertBefore(cancelBtn, submitButton);
    }
}

async function handleDeleteIntegration(id) {
    const integration = allIntegrations.find(i => i.id === id);
    if (!integration) {
        showErrorMessage('Integration not found');
        return;
    }

    if (await showConfirmDialog(`Are you sure you want to delete the integration "${integration.name}"?`)) {
        try {
            await deleteIntegration(id);
        } catch (error) {
            showErrorMessage(error.message);
        }
    }
}

async function syncIntegration(id, type) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}/sync-${type}`, {
            method: 'POST',
            ...auth.addAuthHeader()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to sync integration');
        }

        showSuccessMessage('Integration synced successfully');
        await loadIntegrations();
        return true;
    } catch (error) {
        console.error('Error syncing integration:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

async function editIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return;
            }
            throw new Error('Failed to fetch integration details');
        }
        
        const integration = await response.json();
        
        // Show and populate form
        const form = document.getElementById('integrationEditForm');
        const formContainer = document.getElementById('integrationForm');
        if (form && formContainer) {
            form.dataset.editId = id;
            document.getElementById('integrationName').value = integration.name;
            document.getElementById('integrationType').value = integration.type;
            document.getElementById('integrationType').disabled = true; // Disable type change when editing
            document.getElementById('integrationActive').checked = integration.is_active;
            
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

async function loadConnectedBanks(sourceId) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-accounts`, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return [];
            }
            throw new Error('Failed to load connected bank accounts');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading connected banks:', error);
        showErrorMessage(error.message);
        return [];
    }
}

// Export all functions at the end of the file
export {
    loadIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    handleEditIntegration,
    handleDeleteIntegration,
    syncIntegration,
    showLoading,
    hideLoading,
    editIntegration,
    loadConnectedBanks,
    allIntegrations
}; 