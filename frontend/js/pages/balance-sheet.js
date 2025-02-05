import { loadBalanceSheet } from '../modules/reports.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial balance sheet
        await loadBalanceSheet();

        // Set up event listener for refresh button
        const refreshBtn = document.querySelector('[data-action="refresh-balance-sheet"]');
        const dateInput = document.getElementById('balanceSheetDate');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const date = dateInput.value;
                await loadBalanceSheet(date);
            });
        }

        // Set up event listener for date change
        if (dateInput) {
            dateInput.addEventListener('change', async () => {
                await loadBalanceSheet(dateInput.value);
            });

            // Set default date to today if not set
            if (!dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
                await loadBalanceSheet(dateInput.value);
            }
        }
    } catch (error) {
        console.error('Error initializing balance sheet:', error);
        alert('Error loading balance sheet. Please refresh the page.');
    }
}); 