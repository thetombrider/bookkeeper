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
            { id: 'secretId', label: 'Secret ID', type: 'text', required: true },
            { id: 'secretKey', label: 'Secret Key', type: 'password', required: true },
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
        const response = await fetch(`${API_URL}/import-sources/`);
        if (!response.ok) {
            throw new Error('Failed to load integrations');
        }
        allIntegrations = await response.json();
        updateIntegrationsList();
        return allIntegrations;
    } catch (error) {
        console.error('Error loading integrations:', error);
        throw error;
    }
}

async function updateIntegrationsList() {
    try {
        const response = await fetch('/api/import-sources');
        if (!response.ok) {
            throw new Error('Failed to fetch integrations');
        }
        
        const integrations = await response.json();
        const tbody = document.querySelector('#integrations-table tbody');
        
        if (!integrations || integrations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">No integrations found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = '';
        for (const integration of integrations) {
            // Create main row for the integration
            const mainRow = document.createElement('tr');
            mainRow.innerHTML = `
                <td>
                    ${integration.type === 'GOCARDLESS' ? `
                        <button class="btn btn-link p-0 me-2 toggle-banks" data-integration-id="${integration.id}">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    ` : ''}
                    ${integration.name}
                </td>
                <td>${integration.type}</td>
                <td>${integration.is_active ? 'Active' : 'Inactive'}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${integration.id}">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${integration.id}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(mainRow);
            
            // For GoCardless integrations, create a hidden row for bank details
            if (integration.type === 'GOCARDLESS') {
                const bankDetailsRow = document.createElement('tr');
                bankDetailsRow.classList.add('bank-details-row', 'd-none');
                bankDetailsRow.dataset.integrationId = integration.id;
                bankDetailsRow.innerHTML = `
                    <td colspan="4">
                        <div class="ms-4">
                            <table class="table table-sm mb-0">
                                <thead>
                                    <tr>
                                        <th>Account Name</th>
                                        <th>IBAN</th>
                                        <th>Requisition ID</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="connected-banks-list">
                                    <tr>
                                        <td colspan="4" class="text-center">
                                            <div class="spinner-border spinner-border-sm" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>
                `;
                tbody.appendChild(bankDetailsRow);
                
                // Add click handler for the toggle button
                const toggleButton = mainRow.querySelector('.toggle-banks');
                toggleButton.addEventListener('click', async (e) => {
                    const button = e.currentTarget;
                    const icon = button.querySelector('i');
                    const detailsRow = tbody.querySelector(`.bank-details-row[data-integration-id="${button.dataset.integrationId}"]`);
                    const banksList = detailsRow.querySelector('.connected-banks-list');
                    
                    // Toggle visibility
                    detailsRow.classList.toggle('d-none');
                    icon.classList.toggle('bi-chevron-right');
                    icon.classList.toggle('bi-chevron-down');
                    
                    // Load banks if expanding
                    if (!detailsRow.classList.contains('d-none')) {
                        banksList.innerHTML = await loadConnectedBanks(integration);
                    }
                });
            }
        }
        
        // Add click handlers for action buttons
        tbody.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
        });
        
    } catch (error) {
        console.error('Error updating integrations list:', error);
        showError('Failed to update integrations list');
    }
}

async function loadConnectedBanks(integration) {
    try {
        const response = await fetch(`/api/import-sources/${integration.id}/gocardless-accounts`);
        if (!response.ok) {
            throw new Error(`Failed to load accounts: ${response.statusText}`);
        }
        
        const accounts = await response.json();
        if (!accounts || accounts.length === 0) {
            return `<tr><td colspan="4" class="text-center">No connected banks found</td></tr>`;
        }
        
        return accounts.map(account => `
            <tr>
                <td>${account.name || 'Unknown'}</td>
                <td>${account.iban || 'Not available'}</td>
                <td>${account.requisition_id}</td>
                <td>
                    <button class="btn btn-sm btn-danger" 
                            onclick="disconnectBank('${integration.id}', '${account.requisition_id}')">
                        Disconnect
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading connected banks:', error);
        return `<tr><td colspan="4" class="text-center text-danger">Error loading connected banks</td></tr>`;
    }
}

async function disconnectBank(sourceId, requisitionId) {
    if (!confirm('Are you sure you want to disconnect this bank?')) {
        return;
    }
    
    try {
        const response = await fetch(
            `/api/import-sources/${sourceId}/gocardless-requisition/${requisitionId}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to disconnect bank: ${response.statusText}`);
        }
        
        // Refresh the integrations list
        await updateIntegrationsList();
        
    } catch (error) {
        console.error('Error disconnecting bank:', error);
        alert('Failed to disconnect bank. Please try again.');
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

export async function createIntegration(integrationData) {
    try {
        const response = await fetch(`${API_URL}/import-sources/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(integrationData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to create integration');
        }

        showSuccessMessage('Integration created successfully!');
        await loadIntegrations();
    } catch (error) {
        console.error('Error creating integration:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function updateIntegration(id, integrationData) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(integrationData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to update integration');
        }

        showSuccessMessage('Integration updated successfully!');
        await loadIntegrations();
    } catch (error) {
        console.error('Error updating integration:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function deleteIntegration(id) {
    try {
        const response = await fetch(`${API_URL}/import-sources/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to delete integration');
        }

        showSuccessMessage('Integration deleted successfully!');
        await loadIntegrations();
    } catch (error) {
        console.error('Error deleting integration:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function syncIntegration(id) {
    try {
        const integration = allIntegrations.find(i => i.id === id);
        if (!integration) throw new Error('Integration not found');

        let endpoint;
        switch (integration.type) {
            case 'gocardless':
                endpoint = `${API_URL}/import-sources/${id}/sync-gocardless`;
                break;
            case 'csv':
                // Handle CSV upload through a different mechanism
                showErrorMessage('CSV import requires file upload. Please use the import button in the transactions page.');
                return;
            default:
                throw new Error('Sync not supported for this integration type');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to sync integration');
        }

        showSuccessMessage('Integration synced successfully!');
        await loadIntegrations();
    } catch (error) {
        console.error('Error syncing integration:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

function formatIntegrationType(type) {
    const types = {
        tally: 'Tally',
        gocardless: 'GoCardless',
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
async function handleSetup(sourceId) {
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
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-banks?country=${country}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Secret-Id': config.secretId,
                'X-Secret-Key': config.secretKey
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            if (data.response) {
                throw new Error(data.response.detail || data.response.summary || 'Failed to fetch banks');
            }
            throw new Error(data.detail || 'Failed to fetch banks');
        }
        const banks = await response.json();
        
        // Hide loading state
        hideLoading();
        
        // Get modal elements
        const modal = new bootstrap.Modal(document.getElementById('bankSelectionModal'));
        const banksList = document.getElementById('banksList');
        const searchInput = document.getElementById('bankSearch');
        
        // Function to render banks
        function renderBanks(banksToRender) {
            banksList.innerHTML = banksToRender.map(bank => `
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <h6 class="card-title">${bank.name}</h6>
                            <button class="btn btn-primary btn-sm mt-2" onclick="selectBank('${sourceId}', '${bank.id}')">
                                Select
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Initial render
        renderBanks(banks);
        
        // Add search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredBanks = banks.filter(bank => 
                bank.name.toLowerCase().includes(searchTerm)
            );
            renderBanks(filteredBanks);
        });
        
        // Show modal
        modal.show();
        
    } catch (error) {
        console.error('Error in handleSetup:', error);
        showError(error.message || 'Failed to load banks. Please try again.');
        hideLoading();
    }
}

// Function to handle bank selection
async function selectBank(sourceId, bankId) {
    try {
        showLoading();
        
        // Get the integration config for credentials
        const integration = allIntegrations.find(i => i.id === sourceId);
        if (!integration) throw new Error('Integration not found');
        
        const config = JSON.parse(integration.config || '{}');
        
        if (!config.secretId || !config.secretKey) {
            throw new Error('Missing GoCardless credentials. Please check your integration configuration.');
        }
        
        // Create requisition
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-requisition`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Secret-Id': config.secretId,
                'X-Secret-Key': config.secretKey
            },
            body: JSON.stringify({ bank_id: bankId })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Failed to create bank requisition');
        }

        // Open bank authentication in new window
        const authWindow = window.open(data.link, '_blank');
        
        // Start polling for accounts
        await pollForAccounts(sourceId, config);
        
        hideLoading();
        showSuccess('Bank connection successful!');
        
        // Refresh integrations list
        await loadIntegrations();
        
    } catch (error) {
        console.error('Error in selectBank:', error);
        hideLoading();
        showError(error.message);
    }
}

async function pollForAccounts(sourceId, config) {
    const maxAttempts = 30; // 5 minutes maximum polling time
    const delayMs = 10000; // 10 seconds between attempts
    let attempts = 0;

    const checkAccounts = async () => {
        try {
            const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-accounts`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Secret-Id': config.secretId,
                    'X-Secret-Key': config.secretKey
                }
            });
            
            if (response.ok) {
                return true;
            }
            
            // If we get a 500 error, it likely means the authorization is not complete
            if (response.status === 500) {
                return false;
            }
            
            // For other errors, throw them
            const data = await response.json();
            throw new Error(data.detail || 'Failed to check account status');
            
        } catch (error) {
            if (error.message.includes('Failed to check account status')) {
                throw error;
            }
            return false;
        }
    };

    while (attempts < maxAttempts) {
        if (await checkAccounts()) {
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempts++;
    }

    throw new Error('Timed out waiting for bank authorization. Please try again.');
}

// Update click handler to include setup action
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
            case 'delete':
                if (await showConfirmDialog('Are you sure you want to delete this integration?')) {
                    await deleteIntegration(id);
                }
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
});

// Make selectBank globally available
window.selectBank = selectBank;

// Add form submission handler
document.addEventListener('DOMContentLoaded', () => {
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
                } else {
                    await createIntegration(formData);
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
});

// Make disconnectBank function globally available
window.disconnectBank = disconnectBank; 