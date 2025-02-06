import { loadBalanceSheet } from '../modules/reports.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial balance sheet
        await loadBalanceSheet();

        // Set up event listener for refresh button
        const refreshBtn = document.querySelector('[data-action="refresh-balance-sheet"]');
        const dateInput = document.getElementById('balanceSheetDate');

        if (refreshBtn) {
            // Remove any existing event listeners by cloning and replacing
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);

            newRefreshBtn.addEventListener('click', async () => {
                const date = dateInput.value;
                await loadBalanceSheet(date);
            });
        }

        // Set up event listener for date change
        if (dateInput) {
            // Remove any existing event listeners by cloning and replacing
            const newDateInput = dateInput.cloneNode(true);
            dateInput.parentNode.replaceChild(newDateInput, dateInput);

            newDateInput.addEventListener('change', async () => {
                await loadBalanceSheet(newDateInput.value);
            });

            // Set default date to today if not set
            if (!newDateInput.value) {
                newDateInput.value = new Date().toISOString().split('T')[0];
                await loadBalanceSheet(newDateInput.value);
            }
        }
    } catch (error) {
        console.error('Error initializing balance sheet:', error);
        alert('Error loading balance sheet. Please refresh the page.');
    }
}); 