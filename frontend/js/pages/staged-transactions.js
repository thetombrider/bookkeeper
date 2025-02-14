import { 
    loadStagedTransactions, 
    processStagedTransaction, 
    bulkProcessTransactions,
    deleteStagedTransaction,
    bulkDeleteStagedTransactions,
    toggleTransactionSelection,
    getSelectedTransactions,
    updateSelectionButtons
} from '../modules/staged-transactions.js';
import { loadAccounts } from '../modules/accounts.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from '../modules/modal.js';
import { auth } from '../modules/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    auth.requireAuth();
    
    // Load initial data
    await Promise.all([
        loadStagedTransactions(),
        loadAccounts()
    ]);

    // Set up event handlers
    setupEventHandlers();
    
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(el => new bootstrap.Tooltip(el));

});

function setupEventHandlers() {
    // Select all checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.onchange = (e) => {
            const checkboxes = document.querySelectorAll('.transaction-select:not(:disabled)');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                toggleTransactionSelection(checkbox.value, e.target.checked);
            });
        };
    }

    // Individual checkboxes
    const table = document.getElementById('stagedTransactionsTable');
    if (table) {
        table.addEventListener('change', (e) => {
            if (e.target.classList.contains('transaction-select')) {
                toggleTransactionSelection(e.target.value, e.target.checked);
            }
        });

        // Table actions
        table.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            try {
                switch (action) {
                    case 'process':
                        await showProcessModal([id]);
                        break;
                    case 'view':
                        await showTransactionDetails(id);
                        break;
                    case 'delete':
                        if (await showConfirmDialog('Are you sure you want to delete this transaction?')) {
                            await deleteStagedTransaction(id);
                        }
                        break;
                }
            } catch (error) {
                console.error('Error handling action:', error);
                showErrorMessage(error.message);
            }
        });
    }

    // Process selected button
    const processSelectedBtn = document.querySelector('[data-action="process-selected"]');
    if (processSelectedBtn) {
        processSelectedBtn.onclick = async () => {
            const selectedIds = getSelectedTransactions();
            if (selectedIds.length > 0) {
                await showProcessModal(selectedIds);
            }
        };
    }

    // Delete selected button
    const deleteSelectedBtn = document.querySelector('[data-action="delete-selected"]');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.onclick = async () => {
            const selectedIds = getSelectedTransactions();
            if (selectedIds.length > 0) {
                if (await showConfirmDialog(`Are you sure you want to delete ${selectedIds.length} transactions?`)) {
                    await bulkDeleteStagedTransactions(selectedIds);
                }
            }
        };
    }

    // Apply filters button
    const filterBtn = document.querySelector('[data-action="apply-filters"]');
    if (filterBtn) {
        filterBtn.onclick = applyFilters;
    }
}

async function showProcessModal(transactionIds) {
    const modal = new bootstrap.Modal(document.getElementById('processTransactionModal'));
    const form = document.getElementById('processTransactionForm');
    const accountSelect = document.getElementById('counterpartAccount');
    const confirmBtn = modal._element.querySelector('[data-action="confirm-process"]');

    // Load accounts into select
    const accounts = await loadAccounts();
    accountSelect.innerHTML = `
        <option value="">Select account...</option>
        ${accounts.map(account => `
            <option value="${account.id}">${account.name}</option>
        `).join('')}
    `;

    // Handle form submission
    confirmBtn.onclick = async () => {
        const accountId = accountSelect.value;
        if (!accountId) {
            showErrorMessage('Please select a counterpart account');
            return;
        }

        try {
            if (transactionIds.length === 1) {
                await processStagedTransaction(transactionIds[0], accountId);
            } else {
                await bulkProcessTransactions(transactionIds, accountId);
            }
            modal.hide();
        } catch (error) {
            console.error('Error processing transactions:', error);
            showErrorMessage(error.message);
        }
    };

    modal.show();
}

async function showTransactionDetails(id) {
    try {
        const response = await fetch(`${API_URL}/staged-transactions/${id}`);
        if (!response.ok) throw new Error('Failed to fetch transaction details');
        
        const transaction = await response.json();
        
        // Create and show modal with transaction details
        const modalHtml = `
            <div class="modal fade" id="transactionDetailsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Transaction Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <dl class="row">
                                <dt class="col-sm-4">Date</dt>
                                <dd class="col-sm-8">${new Date(transaction.transaction_date).toLocaleDateString('it-IT')}</dd>
                                
                                <dt class="col-sm-4">Description</dt>
                                <dd class="col-sm-8">${transaction.description}</dd>
                                
                                <dt class="col-sm-4">Amount</dt>
                                <dd class="col-sm-8">${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}</dd>
                                
                                <dt class="col-sm-4">Source</dt>
                                <dd class="col-sm-8">${transaction.source.name}</dd>
                                
                                <dt class="col-sm-4">Account</dt>
                                <dd class="col-sm-8">${transaction.account ? transaction.account.name : '-'}</dd>
                                
                                <dt class="col-sm-4">Status</dt>
                                <dd class="col-sm-8">
                                    <span class="badge ${getStatusBadgeClass(transaction.status)}">
                                        ${formatStatus(transaction.status)}
                                    </span>
                                </dd>
                                
                                ${transaction.error_message ? `
                                    <dt class="col-sm-4">Error</dt>
                                    <dd class="col-sm-8 text-danger">${transaction.error_message}</dd>
                                ` : ''}
                                
                                <dt class="col-sm-4">Raw Data</dt>
                                <dd class="col-sm-8">
                                    <pre class="bg-light p-2 rounded"><code>${JSON.stringify(JSON.parse(transaction.raw_data || '{}'), null, 2)}</code></pre>
                                </dd>
                            </dl>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
        document.body.appendChild(modalElement);
        
        const modal = new bootstrap.Modal(modalElement);
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
        modal.show();
    } catch (error) {
        console.error('Error showing transaction details:', error);
        showErrorMessage(error.message);
    }
}

async function applyFilters() {
    const filters = {
        start_date: document.getElementById('filterStartDate').value,
        end_date: document.getElementById('filterEndDate').value,
        source_id: document.getElementById('filterSource').value,
        status: document.getElementById('filterStatus').value
    };

    try {
        await loadStagedTransactions(filters);
        showSuccessMessage('Filters applied successfully');
    } catch (error) {
        console.error('Error applying filters:', error);
        showErrorMessage(error.message);
    }
}

function getStatusBadgeClass(status) {
    const classes = {
        pending: 'bg-warning',
        processed: 'bg-success',
        error: 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
} 