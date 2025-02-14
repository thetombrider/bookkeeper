import { loadBalanceSheet } from '../modules/reports.js';
import { showSuccessMessage, showErrorMessage } from '../modules/modal.js';
import { auth } from '../modules/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    auth.requireAuth();

    const dateInput = document.getElementById('balanceSheetDate');
    const refreshBtn = document.querySelector('[data-action="refresh-balance-sheet"]');
    const logoutBtn = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');

    // Set user name if available
    if (userName) {
        auth.getCurrentUser().then(user => {
            if (user && user.name) {
                userName.textContent = user.name;
            }
        });
    }

    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });
    }

    async function refreshBalanceSheet() {
        const date = document.getElementById('balanceSheetDate').value;
        
        if (date) {
            try {
                await loadBalanceSheet(date);
                showSuccessMessage('Balance sheet refreshed successfully!');
            } catch (error) {
                console.error('Error loading balance sheet:', error);
                if (error.message.includes('401')) {
                    auth.logout(); // Redirect to login if unauthorized
                } else {
                    showErrorMessage('Error loading balance sheet: ' + error.message);
                }
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