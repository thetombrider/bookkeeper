import { loadIncomeStatement } from '../modules/reports.js';
import { showSuccessMessage, showErrorMessage } from '../modules/modal.js';

document.addEventListener('DOMContentLoaded', () => {
    // Get the input elements and refresh button
    const startDateInput = document.getElementById('incomeStartDate');
    const endDateInput = document.getElementById('incomeEndDate');
    const refreshBtn = document.querySelector('[data-action="refresh-income-statement"]');

    async function refreshIncomeStatement() {
        const startDate = document.getElementById('incomeStartDate').value;
        const endDate = document.getElementById('incomeEndDate').value;
        
        if (startDate && endDate) {
            try {
                await loadIncomeStatement(startDate, endDate);
                showSuccessMessage('Income statement refreshed successfully!');
            } catch (error) {
                console.error('Error loading income statement:', error);
                showErrorMessage('Error loading income statement: ' + error.message);
            }
        } else {
            showErrorMessage('Please select both start and end dates');
        }
    }

    // Set up event listeners
    if (startDateInput && endDateInput) {
        [startDateInput, endDateInput].forEach(input => {
            input.addEventListener('change', () => {
                // Don't automatically refresh on date change
                // Let user click the refresh button instead
                console.log(`Date changed - ${input.id}: ${input.value}`);
            });
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshIncomeStatement);
    }

    // Set default dates if none are set
    if (!startDateInput.value || !endDateInput.value) {
        const today = new Date();
        const firstOfYear = new Date(today.getFullYear(), 0, 1);
        
        // Adjust for timezone
        const offset = firstOfYear.getTimezoneOffset();
        const firstOfYearAdjusted = new Date(firstOfYear.getTime() - (offset * 60 * 1000));
        
        startDateInput.value = firstOfYearAdjusted.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];
        
        // Load initial income statement
        refreshIncomeStatement();
    }
}); 