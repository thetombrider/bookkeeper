import { loadBalanceSheet } from '../modules/reports.js';
import { showSuccessMessage, showErrorMessage } from '../modules/modal.js';

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('balanceSheetDate');
    const refreshBtn = document.querySelector('[data-action="refresh-balance-sheet"]');

    async function refreshBalanceSheet() {
        const date = document.getElementById('balanceSheetDate').value;
        
        if (date) {
            try {
                await loadBalanceSheet(date);
                showSuccessMessage('Balance sheet refreshed successfully!');
            } catch (error) {
                console.error('Error loading balance sheet:', error);
                showErrorMessage('Error loading balance sheet: ' + error.message);
            }
        } else {
            showErrorMessage('Please select a date');
        }
    }

    // Set up event listeners
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            // Don't automatically refresh on date change
            // Let user click the refresh button instead
            console.log(`Date changed - ${dateInput.id}: ${dateInput.value}`);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshBalanceSheet);
    }

    // Set default date if none is set
    if (!dateInput.value) {
        const today = new Date();
        dateInput.value = today.toISOString().split('T')[0];
        
        // Load initial balance sheet
        refreshBalanceSheet();
    }
}); 