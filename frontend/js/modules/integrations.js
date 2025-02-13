import { API_URL } from './config.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from './modal.js';

export let allIntegrations = [];

// Utility functions for loading state
let loadingOverlay;

function showLoading() {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        // Add style if not already present
        if (!document.querySelector('#loading-overlay-style')) {
            const style = document.createElement('style');
            style.id = 'loading-overlay-style';
            style.textContent = `
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
            `;
            document.head.appendChild(style);
        }
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Utility functions for success/error messages
function showSuccess(message) {
    showSuccessMessage(message);
}

function showError(message) {
    showErrorMessage(message);
}

// Configuration templates for different integration types
const integrationConfigs = {
    tally: {
        fields: [
            { id: 'webhookUrl', label: 'Webhook URL', type: 'text', readonly: true, value: `${API_URL}/webhooks/tally` }
        ]
    },
    gocardless: {
        fields: [
            { id: 'secretId', label: 'Nordigen Secret ID', type: 'text', required: true },
            { id: 'secretKey', label: 'Nordigen Secret Key', type: 'password', required: true },
            { id: 'country', label: 'Country', type: 'text', value: 'IT', required: true }
        ]
    },
    csv: {
        fields: [
            { id: 'delimiter', label: 'Delimiter', type: 'text', value: ',', required: true },
            { id: 'dateFormat', label: 'Date Format', type: 'text', value: 'YYYY-MM-DD', required: true }
        ]
    }
};

export async function loadIntegrations() {
    try {
        const response = await fetch(`${API_URL}/import-sources/?active_only=false`);
        if (!response.ok) {
            throw new Error('Failed to fetch integrations');
        }
        
        const integrations = await response.json();
        allIntegrations = integrations; // Store integrations in the global array
        await updateIntegrationsList(integrations);
        return integrations;
    } catch (error) {
        console.error('Error loading integrations:', error);
        throw error;
    }
}

async function updateIntegrationsList(integrations) {
    const listContainer = document.getElementById('integrationsList');
    if (!listContainer) return;

    if (!integrations || integrations.length === 0) {
        listContainer.innerHTML = `
            <table class="table table-hover mb-0">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Last Sync</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            No integrations found.
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
        return;
    }

    const rows = await Promise.all(integrations.map(async integration => {
        let bankConnectionsHtml = '';
        
        if (integration.type === 'gocardless' && integration.is_active) {
            try {
                console.log('Fetching accounts for integration:', integration.id);
                const accounts = await loadConnectedBanks(integration);
                console.log('Raw accounts data:', accounts);
                
                if (accounts && accounts.length > 0) {
                    // Group accounts by bank connection
                    const bankGroups = {};
                    accounts.forEach(account => {
                        if (!account.connection) {
                            console.warn('Account missing connection data:', account);
                            return;
                        }
                        
                        const bankName = account.connection.bank_name;
                        if (!bankGroups[bankName]) {
                            bankGroups[bankName] = {
                                bank_id: account.connection.bank_id,
                                requisition_id: account.connection.requisition_id,
                                accounts: []
                            };
                        }
                        bankGroups[bankName].accounts.push(account);
                    });

                    // Generate HTML for each bank group
                    bankConnectionsHtml = Object.entries(bankGroups).map(([bankName, group]) => `
                        <div class="bank-connection mt-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>${bankName}</strong>
                                <button class="btn btn-sm btn-outline-danger" 
                                        data-action="disconnect-bank" 
                                        data-source-id="${integration.id}"
                                        data-requisition-id="${group.requisition_id}">
                                    <i class="bi bi-x-circle"></i> Disconnect
                                </button>
                            </div>
                            <ul class="list-unstyled ms-3 mb-0 mt-1">
                                ${group.accounts.map(account => `
                                    <li class="small text-muted">
                                        ${account.name} (${account.iban || 'No IBAN'})
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error loading connected banks:', error);
            }
        }

        return `
            <tr>
                <td>
                    ${integration.name}
                    ${bankConnectionsHtml}
                </td>
                <td>${formatIntegrationType(integration.type)}</td>
                <td>
                    <span class="badge ${integration.is_active ? 'bg-success' : 'bg-danger'}">
                        ${integration.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${formatLastSync(integration)}</td>
                <td class="text-end">
                    ${integration.type === 'gocardless' && integration.is_active ? `
                        <button class="btn btn-sm btn-outline-primary" data-action="setup" data-id="${integration.id}">
                            <i class="bi bi-bank"></i> Setup
                        </button>
                        <button class="btn btn-sm btn-outline-primary" data-action="sync" data-id="${integration.id}">
                            <i class="bi bi-arrow-repeat"></i> Sync
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${integration.id}">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${integration.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }));

    listContainer.innerHTML = `
        <table class="table table-hover mb-0">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th class="text-end">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows.join('\n')}
            </tbody>
        </table>
    `;
}

// Add necessary styles
const style = document.createElement('style');
style.textContent = `
    .bank-header {
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 0.25rem;
    }
    .bank-header:hover {
        background-color: rgba(0,0,0,0.05);
    }
    .toggle-icon {
        transition: transform 0.2s ease-in-out;
    }
    .bank-header[aria-expanded="true"] .toggle-icon {
        transform: rotate(90deg);
    }
    .connected-banks-row {
        background-color: #f8f9fa;
    }
    .bank-header .btn {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
    }
    .bank-header .btn:hover {
        background-color: #dc3545;
        color: white;
    }
`;
document.head.appendChild(style);

export async function loadConnectedBanks(integration) {
    try {
        // First get the bank connections
        const response = await fetch(`${API_URL}/import-sources/${integration.id}/gocardless-accounts`);
        if (!response.ok) {
            throw new Error('Failed to fetch connected banks');
        }
        const accounts = await response.json();
        console.log('Raw accounts data:', accounts);
        return accounts;
    } catch (error) {
        console.error('Error loading connected banks:', error);
        throw error;
    }
}

export async function disconnectBank(sourceId, requisitionId) {
    if (!confirm('Are you sure you want to disconnect this bank?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-requisition/${requisitionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to disconnect bank');
        }
        
        await loadIntegrations();
    } catch (error) {
        console.error('Error disconnecting bank:', error);
        throw error;
    }
}

export function updateConfigFields(type) {
    const configFields = document.getElementById('configFields');
    if (!configFields) return;

    const config = integrationConfigs[type];
    if (!config) {
        configFields.innerHTML = '';
        return;
    }

    configFields.innerHTML = config.fields.map(field => `
        <div class="mb-3">
            <label for="${field.id}" class="form-label">${field.label}</label>
            <input type="${field.type}" 
                   id="${field.id}" 
                   class="form-control" 
                   ${field.value ? `value="${field.value}"` : ''} 
                   ${field.readonly ? 'readonly' : ''}
                   ${field.required ? 'required' : ''}>
        </div>
    `).join('');
}

export async function createIntegration(data) {
    try {
        const response = await fetch(`${API_URL}/import-sources/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create integration');
        }
        
        await loadIntegrations();
        return response.json();
    } catch (error) {
        console.error('Error creating integration:', error);
        throw error;
    }
}

export async function updateIntegration(id, data) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update integration');
        }

        showSuccess('Integration updated successfully');
        await loadIntegrations();
    } catch (error) {
        console.error('Error updating integration:', error);
        showError(error.message);
        throw error;
    }
}

export async function deleteIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete integration');
        }
        
        await loadIntegrations();
        showSuccess('Integration deleted successfully');
    } catch (error) {
        console.error('Error deleting integration:', error);
        throw error;
    }
}

export async function syncIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}/sync-gocardless`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync integration');
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error syncing integration:', error);
        throw error;
    }
}

export async function editIntegration(id) {
    try {
        const integration = allIntegrations.find(i => i.id === id);
        if (!integration) {
            throw new Error('Integration not found');
        }

        // Show and populate form
        const form = document.getElementById('integrationEditForm');
        const formContainer = document.getElementById('integrationForm');
        if (form && formContainer) {
            form.dataset.editId = id;
            document.getElementById('integrationName').value = integration.name;
            document.getElementById('integrationType').value = integration.type;
            document.getElementById('integrationType').disabled = true; // Don't allow type changes during edit
            document.getElementById('integrationActive').checked = integration.is_active;
            
            // Update config fields for the integration type
            updateConfigFields(integration.type);
            
            // Populate config values if they exist
            if (integration.config) {
                const config = JSON.parse(integration.config);
                Object.entries(config).forEach(([key, value]) => {
                    const field = document.getElementById(key);
                    if (field) field.value = value;
                });
            }
            
            // Update form title and button
            formContainer.querySelector('.card-title').textContent = 'Edit Integration';
            form.querySelector('button[type="submit"]').textContent = 'Update Integration';
            
            // Show form
            formContainer.style.display = 'block';
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('Error editing integration:', error);
        showError(error.message);
        throw error;
    }
}

function formatIntegrationType(type) {
    const types = {
        tally: 'Tally',
        gocardless: 'Nordigen Bank Integration',
        csv: 'CSV Import'
    };
    return types[type] || type;
}

function formatLastSync(integration) {
    // This would need to be implemented based on how you track last sync
    return 'Never'; // Placeholder
}

// Add bank selection modal HTML
const bankSelectionModal = `
<div class="modal fade" id="bankSelectionModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Select Your Bank</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <input type="text" class="form-control" id="bankSearch" placeholder="Search for your bank...">
                </div>
                <div id="banksList" class="row g-3">
                    <!-- Banks will be loaded here -->
                </div>
            </div>
        </div>
    </div>
</div>
`;

// Add modal to the page
document.body.insertAdjacentHTML('beforeend', bankSelectionModal);

// Bank selection and setup functionality
export async function handleSetup(sourceId) {
    try {
        // Show loading state
        showLoading();
        
        // Get the integration details to get the country from config
        const integration = allIntegrations.find(i => i.id === sourceId);
        if (!integration) throw new Error('Integration not found');
        
        const config = JSON.parse(integration.config || '{}');
        const country = config.country || 'IT';
        
        if (!config.secretId || !config.secretKey) {
            throw new Error('Missing GoCardless credentials. Please check your integration configuration.');
        }
        
        // Fetch available banks
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-banks?country=${country}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch banks');
        }
        const banks = await response.json();
        
        // Hide loading state
        hideLoading();
        
        // Create modal content for bank selection
        const modalHtml = `
            <div class="modal fade" id="bankSelectionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Select Your Bank</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <input type="text" class="form-control" id="bankSearch" placeholder="Search banks...">
                            </div>
                            <div class="list-group" id="banksList">
                                ${banks.map(bank => `
                                    <button type="button" class="list-group-item list-group-item-action bank-item" 
                                            data-bank-id="${bank.id}">
                                        ${bank.name}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
        document.body.appendChild(modalElement);
        
        // Initialize modal
        const modal = new bootstrap.Modal(modalElement);
        
        // Add search functionality
        const searchInput = modalElement.querySelector('#bankSearch');
        const banksList = modalElement.querySelector('#banksList');
        const bankItems = banksList.querySelectorAll('.bank-item');

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            bankItems.forEach(item => {
                const bankName = item.textContent.toLowerCase();
                item.style.display = bankName.includes(searchTerm) ? 'block' : 'none';
            });
        });

        // Handle bank selection
        banksList.addEventListener('click', async (e) => {
            const bankItem = e.target.closest('.bank-item');
            if (!bankItem) return;

            const bankId = bankItem.dataset.bankId;
            modal.hide();

            try {
                showLoading();
                
                // Create requisition with redirect URL
                const currentUrl = window.location.href;
                const redirectUrl = new URL('integrations.html', currentUrl);
                redirectUrl.searchParams.set('source_id', sourceId);
                redirectUrl.searchParams.set('action', 'bank_connected');

                const reqResponse = await fetch(
                    `${API_URL}/import-sources/${sourceId}/gocardless-requisition`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            bank_id: bankId,
                            redirect_url: redirectUrl.toString()
                        })
                    }
                );

                if (!reqResponse.ok) {
                    const errorData = await reqResponse.json();
                    throw new Error(errorData.detail || 'Failed to create bank requisition');
                }

                const { link } = await reqResponse.json();
                hideLoading();

                // Show confirmation modal
                const confirmModalHtml = `
                    <div class="modal fade" id="bankConfirmModal" tabindex="-1">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Connect to Your Bank</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="alert alert-info">
                                        <i class="bi bi-info-circle me-2"></i>
                                        You will be redirected to your bank's website to authorize access.
                                    </div>
                                    <p>Please follow these steps:</p>
                                    <ol>
                                        <li>Click the button below to open your bank's login page</li>
                                        <li>Log in to your bank account</li>
                                        <li>Authorize access to your account data</li>
                                        <li>You will be automatically redirected back to this page</li>
                                    </ol>
                                    <div class="d-grid gap-2">
                                        <a href="${link}" class="btn btn-primary">
                                            <i class="bi bi-bank"></i> Connect to Bank
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const confirmModalElement = new DOMParser().parseFromString(confirmModalHtml, 'text/html').body.firstChild;
                document.body.appendChild(confirmModalElement);
                const confirmModal = new bootstrap.Modal(confirmModalElement);
                
                // Show the confirmation modal
                confirmModal.show();

                // Clean up when modal is hidden
                confirmModalElement.addEventListener('hidden.bs.modal', () => {
                    confirmModalElement.remove();
                });

            } catch (error) {
                hideLoading();
                showError(error.message);
                console.error('Error setting up bank connection:', error);
            }
        });

        // Clean up when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });

        // Show the modal
        modal.show();

    } catch (error) {
        hideLoading();
        showError(error.message);
        console.error('Error in handleSetup:', error);
    }
}

// Remove the old click handler
document.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const id = button.dataset.id;
    
    try {
        switch (action) {
            case 'add-integration':
                const form = document.getElementById('integrationForm');
                if (form) {
                    form.style.display = 'block';
                    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Reset form state
                    const editForm = document.getElementById('integrationEditForm');
                    if (editForm) {
                        editForm.reset();
                        editForm.dataset.editId = '';
                    }
                    document.getElementById('configFields').innerHTML = '';
                }
                break;
            case 'setup':
                await handleSetup(id);
                break;
            case 'cancel-edit':
                const formToHide = document.getElementById('integrationForm');
                if (formToHide) {
                    formToHide.style.display = 'none';
                    const editFormToReset = document.getElementById('integrationEditForm');
                    if (editFormToReset) {
                        editFormToReset.reset();
                        editFormToReset.dataset.editId = '';
                    }
                    document.getElementById('configFields').innerHTML = '';
                }
                break;
        }
    } catch (error) {
        console.error('Error handling action:', error);
        showError(error.message);
    }
});

// Initialize when the module is loaded
window.addEventListener('app-ready', () => {
    loadIntegrations().catch(console.error);
    
    // Set up event handlers
    setupEventHandlers();
});

function setupEventHandlers() {
    // Handle table actions
    document.querySelector('#integrationsList')?.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        try {
            switch (action) {
                case 'delete':
                    e.preventDefault();
                    if (await showConfirmDialog('Are you sure you want to delete this integration?')) {
                        await deleteIntegration(id);
                    }
                    break;
                    
                case 'edit':
                    e.preventDefault();
                    // Find integration in our stored array instead of fetching
                    const integration = allIntegrations.find(i => i.id === id);
                    if (!integration) {
                        showError('Integration not found');
                        return;
                    }

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
                        
                        // Populate config values if they exist
                        try {
                            const config = JSON.parse(integration.config || '{}');
                            Object.entries(config).forEach(([key, value]) => {
                                const field = document.getElementById(key);
                                if (field) field.value = value;
                            });
                        } catch (error) {
                            console.error('Error parsing config:', error);
                        }
                        
                        // Show form
                        formContainer.style.display = 'block';
                        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    break;

                case 'setup':
                    await handleSetup(id);
                    break;

                case 'sync':
                    await syncIntegration(id);
                    showSuccess('Integration synced successfully');
                    await loadIntegrations();
                    break;
            }
        } catch (error) {
            showError('Error: ' + error.message);
        }
    });

    // Handle form submission
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
                    showSuccess('Integration updated successfully');
                } else {
                    await createIntegration(formData);
                    showSuccess('Integration created successfully');
                }

                // Hide form after successful submission
                const formContainer = document.getElementById('integrationForm');
                if (formContainer) {
                    formContainer.style.display = 'none';
                }
                
                // Reset form
                form.reset();
                form.dataset.editId = '';
                document.getElementById('configFields').innerHTML = '';
                
            } catch (error) {
                console.error('Error handling integration:', error);
                showError(error.message);
            }
        });
    }

    // Handle type change
    const typeSelect = document.getElementById('integrationType');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            updateConfigFields(typeSelect.value);
        });
    }

    // Handle cancel button
    const cancelBtn = document.querySelector('[data-action="cancel-edit"]');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const form = document.getElementById('integrationEditForm');
            const formContainer = document.getElementById('integrationForm');
            if (form && formContainer) {
                form.reset();
                form.dataset.editId = '';
                formContainer.style.display = 'none';
                document.getElementById('configFields').innerHTML = '';
            }
        });
    }
}

// Make disconnectBank globally available
window.disconnectBank = disconnectBank;

export async function getIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch integration');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching integration:', error);
        throw error;
    }
} 