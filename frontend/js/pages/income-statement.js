import { loadIncomeStatement } from '../modules/reports.js';

document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners for date inputs and refresh button
    const startDateInput = document.getElementById('incomeStartDate');
    const endDateInput = document.getElementById('incomeEndDate');
    const refreshBtn = document.querySelector('[data-action="refresh-income-statement"]');

    async function refreshIncomeStatement() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        if (startDate && endDate) {
            try {
                await loadIncomeStatement(startDate, endDate);
            } catch (error) {
                console.error('Error loading income statement:', error);
                alert('Error loading income statement. Please try again.');
            }
        }
    }

    // Set up event listeners
    if (startDateInput && endDateInput) {
        [startDateInput, endDateInput].forEach(input => {
            input.addEventListener('change', refreshIncomeStatement);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshIncomeStatement);
    }

    // Set default dates if none are set
    if (!startDateInput.value || !endDateInput.value) {
        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        startDateInput.value = firstOfMonth.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];
        
        // Load initial income statement
        refreshIncomeStatement();
    }
}); 