import { API_URL, formatCurrency } from './config.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from './modal.js';
import { loadAccounts } from './accounts.js';

export let allStagedTransactions = [];
let selectedTransactions = new Set();

export async function loadStagedTransactions(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.source_id) params.append('source_id', filters.source_id);
        if (filters.status) params.append('status', filters.status);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);

        const url = `${API_URL}/staged-transactions/${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to load staged transactions');
        }
        
        allStagedTransactions = await response.json();
        updateTransactionsList();
        return allStagedTransactions;
    } catch (error) {
        console.error('Error loading staged transactions:', error);
        throw error;
    }
}

export async function updateTransactionsList() {
    try {
        const table = document.getElementById('stagedTransactionsTable');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        if (!allStagedTransactions || allStagedTransactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        No staged transactions found.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = allStagedTransactions.map(transaction => `
            <tr>
                <td>
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input transaction-select" 
                               value="${transaction.id}" 
                               ${transaction.status !== 'pending' ? 'disabled' : ''}
                               ${selectedTransactions.has(transaction.id) ? 'checked' : ''}>
                    </div>
                </td>
                <td>${new Date(transaction.transaction_date).toLocaleDateString('it-IT')}</td>
                <td>${transaction.description}</td>
                <td>${transaction.source.name}</td>
                <td>${transaction.account ? transaction.account.name : '-'}</td>
                <td class="text-end numeric">${formatCurrency(transaction.amount)}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(transaction.status)}">
                        ${formatStatus(transaction.status)}
                    </span>
                    ${transaction.error_message ? 
                        `<i class="bi bi-exclamation-circle text-danger ms-2" 
                            data-bs-toggle="tooltip" 
                            title="${transaction.error_message}"></i>` 
                        : ''}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${transaction.id}">
                        <i class="bi bi-eye"></i> View
                    </button>
                    ${transaction.status === 'pending' ? `
                        <button class="btn btn-sm btn-outline-primary" data-action="process" data-id="${transaction.id}">
                            <i class="bi bi-check2"></i> Process
                        </button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${transaction.id}">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

        // Initialize tooltips
        const tooltips = tbody.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(el => new bootstrap.Tooltip(el));

        // Update buttons state
        updateSelectionButtons();
    } catch (error) {
        console.error('Error updating staged transactions list:', error);
        showError('Failed to update staged transactions list');
    }
}

export async function processStagedTransaction(transactionId, counterpartAccountId) {
    try {
        const response = await fetch(`${API_URL}/staged-transactions/${transactionId}/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ counterpart_account_id: counterpartAccountId })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to process transaction');
        }

        showSuccessMessage('Transaction processed successfully!');
        await loadStagedTransactions();
    } catch (error) {
        console.error('Error processing transaction:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function bulkProcessTransactions(transactionIds, counterpartAccountId) {
    try {
        const response = await fetch(`${API_URL}/staged-transactions/bulk-process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                staged_ids: transactionIds,
                counterpart_account_id: counterpartAccountId
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to process transactions');
        }

        showSuccessMessage('Transactions processed successfully!');
        selectedTransactions.clear();
        await loadStagedTransactions();
    } catch (error) {
        console.error('Error processing transactions:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function deleteStagedTransaction(transactionId) {
    try {
        const response = await fetch(`${API_URL}/staged-transactions/${transactionId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status !== 404) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to delete transaction');
            }
            return false;
        }

        showSuccessMessage('Transaction deleted successfully!');
        await loadStagedTransactions();
        return true;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export async function bulkDeleteStagedTransactions(transactionIds) {
    try {
        const response = await fetch(`${API_URL}/staged-transactions/bulk-delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(transactionIds)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to delete transactions');
        }

        const result = await response.json();
        if (result && result.errors && result.errors.length > 0) {
            showErrorMessage(`${result.errors.length} transactions failed to delete`);
        } else {
            showSuccessMessage('Transactions deleted successfully!');
        }

        selectedTransactions.clear();
        await loadStagedTransactions();
        return true;
    } catch (error) {
        console.error('Error deleting transactions:', error);
        showErrorMessage(error.message);
        throw error;
    }
}

export function toggleTransactionSelection(transactionId, selected) {
    if (selected) {
        selectedTransactions.add(transactionId);
    } else {
        selectedTransactions.delete(transactionId);
    }
    updateProcessSelectedButton();
}

export function getSelectedTransactions() {
    return Array.from(selectedTransactions);
}

function updateProcessSelectedButton() {
    const btn = document.querySelector('[data-action="process-selected"]');
    if (btn) {
        btn.disabled = selectedTransactions.size === 0;
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

// Initialize tooltips when the module is loaded
window.addEventListener('app-ready', () => {
    loadStagedTransactions().catch(console.error);
}); 