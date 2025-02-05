import { loadBalanceSheet } from '../modules/reports.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial balance sheet
        await loadBalanceSheet();

        // Set up event listener for refresh button
        const refreshBtn = document.querySelector('[data-action="refresh-balance-sheet"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const date = document.getElementById('balanceSheetDate').value;
                await loadBalanceSheet(date);
            });
        }

        // Set up event listener for date change
        const dateInput = document.getElementById('balanceSheetDate');
        if (dateInput) {
            dateInput.addEventListener('change', async () => {
                await loadBalanceSheet(dateInput.value);
            });
        }
    } catch (error) {
        console.error('Error initializing balance sheet:', error);
        alert('Error loading balance sheet. Please refresh the page.');
    }
}); 