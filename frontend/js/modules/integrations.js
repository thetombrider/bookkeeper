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
        // Handle bank connection redirect if necessary
        await handleBankConnectionRedirect();
        
        const response = await fetchWithRetry(`${API_URL}/import-sources/`, auth.addAuthHeader());
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

// Add retry logic for failed requests
async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError') {
                console.log('Request timed out, retrying...');
            } else {
                console.error(`Request failed (attempt ${i + 1}/${maxRetries}):`, error);
            }
            
            if (i < maxRetries - 1) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }
    throw lastError;
}

function updateIntegrationsList(integrations) {
    const list = document.getElementById('integrationsList');
    if (!list) return;

    // Always create the table structure
    list.innerHTML = `
        <table class="table table-hover">
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
                ${!integrations || integrations.length === 0 ? `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            No integrations found
                        </td>
                    </tr>
                ` : integrations.map(integration => `
                    <tr>
                        <td>${integration.name}</td>
                        <td>${formatIntegrationType(integration.type)}</td>
                        <td>
                            <span class="badge ${integration.is_active ? 'bg-success' : 'bg-secondary'}">
                                ${integration.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${formatLastSync(integration)}</td>
                        <td class="text-end">
                            ${integration.is_active ? `
                                <button class="btn btn-sm btn-outline-secondary me-2" 
                                        data-action="sync" 
                                        data-id="${integration.id}"
                                        data-type="${integration.type}">
                                    <i class="bi bi-arrow-repeat"></i> Sync
                                </button>
                                ${integration.type === 'gocardless' ? `
                                <button class="btn btn-sm btn-outline-info me-2" 
                                        data-action="connect-bank" 
                                        data-id="${integration.id}">
                                    <i class="bi bi-bank"></i> Connect Bank
                                </button>
                                ` : ''}
                            ` : ''}
                            <button class="btn btn-sm btn-outline-primary me-2" 
                                    data-action="edit" 
                                    data-id="${integration.id}">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" 
                                    data-action="delete" 
                                    data-id="${integration.id}">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Add event listeners to connect buttons
    list.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        const type = button.dataset.type;

        switch (action) {
            case 'connect-bank':
                await showBankConnectionDialog(id);
                break;
            // ... existing cases ...
        }
    });
}

function formatIntegrationType(type) {
    const types = {
        csv: 'CSV',
        tally: 'Tally',
        gocardless: 'GoCardless'
    };
    return types[type] || type;
}

function formatLastSync(integration) {
    const config = JSON.parse(integration.config || '{}');
    if (config.last_sync) {
        const date = new Date(config.last_sync);
        return date.toLocaleString();
    }
    return 'Never';
}

function updateConfigFields(type) {
    const configFields = document.getElementById('configFields');
    if (!configFields) return;

    let fields = '';
    switch (type) {
        case 'gocardless':
            fields = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="secretId" class="form-label">Secret ID</label>
                        <input type="text" id="secretId" class="form-control" required>
                    </div>
                    <div class="col-md-6">
                        <label for="secretKey" class="form-label">Secret Key</label>
                        <input type="password" id="secretKey" class="form-control" required>
                    </div>
                </div>
            `;
            break;
        case 'tally':
            fields = `
                <div class="row g-3">
                    <div class="col-12">
                        <label for="webhook_url" class="form-label">Webhook URL</label>
                        <input type="url" id="webhook_url" class="form-control" required>
                        <div class="form-text">The URL that Tally will send form submissions to.</div>
                    </div>
                </div>
            `;
            break;
        case 'csv':
            fields = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="date_format" class="form-label">Date Format</label>
                        <input type="text" id="date_format" class="form-control" value="YYYY-MM-DD" required>
                    </div>
                    <div class="col-md-6">
                        <label for="delimiter" class="form-label">Delimiter</label>
                        <input type="text" id="delimiter" class="form-control" value="," required>
                    </div>
                    <div class="col-12">
                        <label for="columns" class="form-label">Column Mapping</label>
                        <textarea id="columns" class="form-control" rows="3" placeholder="date:0,description:1,amount:2"></textarea>
                        <div class="form-text">Map CSV columns to transaction fields (column index starts at 0)</div>
                    </div>
                </div>
            `;
            break;
        default:
            fields = '<div class="alert alert-info">Select an integration type to see configuration options.</div>';
    }

    configFields.innerHTML = fields;
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
            if (response.status === 401) {
                auth.logout();
                return null;
            }
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
            
            // Update config fields for the integration type
            updateConfigFields(integration.type);
            
            // Populate config fields if they exist
            if (integration.config) {
                try {
                    const config = JSON.parse(integration.config);
                    // For GoCardless, ensure we're using the correct field names
                    if (integration.type === 'gocardless') {
                        const secretId = document.getElementById('secretId');
                        const secretKey = document.getElementById('secretKey');
                        if (secretId) secretId.value = config.secretId || '';
                        if (secretKey) secretKey.value = config.secretKey || '';
                    } else {
                        // For other types, populate as before
                        const configFields = document.querySelectorAll('#configFields input, #configFields textarea');
                        configFields.forEach(field => {
                            if (config[field.id] !== undefined) {
                                field.value = config[field.id];
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error parsing integration config:', e);
                }
            }
            
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

async function showBankConnectionDialog(sourceId) {
    try {
        showLoading();
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-banks`, auth.addAuthHeader());
        if (!response.ok) {
            throw new Error('Failed to load banks');
        }
        const banks = await response.json();
        hideLoading();

        // Store banks in state for search functionality
        const allBanks = [...banks];

        // Create modal content
        const modalContent = `
            <div class="modal fade" id="bankConnectionModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Connect Bank Account</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-4">
                                <div class="input-group">
                                    <span class="input-group-text">
                                        <i class="bi bi-search"></i>
                                    </span>
                                    <input type="text" 
                                           class="form-control" 
                                           id="bankSearch" 
                                           placeholder="Search banks..."
                                           autocomplete="off">
                                </div>
                            </div>
                            <div class="row g-3" id="banksList">
                                ${generateBankCards(banks, sourceId)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('bankConnectionModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Initialize modal
        const modal = new bootstrap.Modal(document.getElementById('bankConnectionModal'));
        modal.show();

        // Set up search functionality
        const searchInput = document.getElementById('bankSearch');
        const banksList = document.getElementById('banksList');

        if (searchInput && banksList) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredBanks = allBanks.filter(bank => 
                    bank.name.toLowerCase().includes(searchTerm) ||
                    bank.id.toLowerCase().includes(searchTerm)
                );
                banksList.innerHTML = generateBankCards(filteredBanks, sourceId);
                
                // Reattach event listeners to new buttons
                attachBankConnectHandlers(sourceId);
            });
        }

        // Attach event handlers to connect buttons
        attachBankConnectHandlers(sourceId);

        // Clean up when modal is hidden
        document.getElementById('bankConnectionModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('bankConnectionModal').remove();
        });

    } catch (error) {
        hideLoading();
        console.error('Error showing bank connection dialog:', error);
        showErrorMessage(error.message);
    }
}

// Helper function to generate bank cards HTML
function generateBankCards(banks, sourceId) {
    if (banks.length === 0) {
        return `
            <div class="col-12 text-center text-muted py-4">
                No banks found matching your search.
            </div>
        `;
    }

    return banks.map(bank => `
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-body text-center">
                    <img src="${bank.logo}" alt="${bank.name}" class="img-fluid mb-3" style="max-height: 40px;">
                    <h6 class="card-title">${bank.name}</h6>
                    <button class="btn btn-primary btn-sm connect-bank-btn" 
                            data-bank-id="${bank.id}" 
                            data-source-id="${sourceId}">
                        Connect
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Helper function to attach event handlers to bank connect buttons
async function attachBankConnectHandlers(sourceId) {
    const connectButtons = document.querySelectorAll('[data-action="connect-bank"]');
    
    connectButtons.forEach(button => {
        button.addEventListener('click', async () => {
            try {
                showLoading();
                const bankId = button.dataset.bankId;
                
                // Construct the redirect URL
                const currentUrl = new URL(window.location.href);
                const redirectUrl = `${currentUrl.origin}${currentUrl.pathname}?source_id=${sourceId}&action=bank_connected`;
                
                // Make the request to create requisition
                const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-requisition`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...auth.addAuthHeader().headers
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        bank_id: bankId,
                        redirect_url: redirectUrl
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to connect to bank');
                }

                const data = await response.json();
                
                // Store connection state before redirect
                sessionStorage.setItem('pendingConnection', JSON.stringify({
                    sourceId,
                    timestamp: Date.now()
                }));

                // Close modal before redirect
                const modal = bootstrap.Modal.getInstance(document.getElementById('bankConnectionModal'));
                if (modal) {
                    modal.hide();
                    // Small delay to allow modal to close smoothly
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                // Redirect to bank's authorization page
                window.location.href = data.link;
            } catch (error) {
                hideLoading();
                console.error('Error connecting to bank:', error);
                showErrorMessage('Error connecting to bank: ' + error.message);
            }
        });
    });
}

// Add function to handle bank connection redirect
async function handleBankConnectionRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceId = urlParams.get('source_id');
    const action = urlParams.get('action');
    
    if (sourceId && action === 'bank_connected') {
        try {
            showLoading();
            
            // Store connection state in sessionStorage
            sessionStorage.setItem('pendingConnection', JSON.stringify({
                sourceId,
                timestamp: Date.now()
            }));
            
            // Wait longer for bank processing
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Add retry logic for fetching accounts
            let attempts = 3;
            let lastError = null;
            
            while (attempts > 0) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                    
                    const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-accounts`, {
                        headers: {
                            'Accept': 'application/json',
                            ...auth.addAuthHeader().headers
                        },
                        credentials: 'include',
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Clear connection state
                    sessionStorage.removeItem('pendingConnection');
                    
                    // Verify the connection is legitimate and recent
                    const pendingConnection = JSON.parse(sessionStorage.getItem('pendingConnection') || '{}');
                    if (pendingConnection.sourceId !== sourceId || 
                        Date.now() - pendingConnection.timestamp > 300000) { // 5 minutes
                        throw new Error('Connection verification failed or expired');
                    }
                    
                    hideLoading();
                    
                    if (data.accounts && data.accounts.length > 0) {
                        showSuccessMessage('Bank connected successfully! You can now sync your transactions.');
                        // Clear URL parameters
                        window.history.replaceState({}, document.title, window.location.pathname);
                        return true;
                    } else if (data.errors && data.errors.length > 0) {
                        throw new Error(`Connection errors: ${data.errors.join(', ')}`);
                    } else {
                        throw new Error('No accounts found');
                    }
                } catch (error) {
                    lastError = error;
                    attempts--;
                    if (attempts > 0) {
                        // Exponential backoff
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - attempts) * 1000));
                        continue;
                    }
                    break;
                }
            }
            
            hideLoading();
            if (lastError) {
                console.error('Bank connection error:', lastError);
                showErrorMessage(`Error verifying bank connection: ${lastError.message}`);
            }
            return false;
        } catch (error) {
            hideLoading();
            console.error('Bank connection error:', error);
            showErrorMessage(`Error verifying bank connection: ${error.message}`);
            return false;
        } finally {
            // Always clean up
            sessionStorage.removeItem('pendingConnection');
            // Ensure loading is hidden
            hideLoading();
        }
    }
    return false;
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
    updateConfigFields,
    allIntegrations
}; 