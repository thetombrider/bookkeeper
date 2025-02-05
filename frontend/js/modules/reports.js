import { API_URL, formatCurrency } from './config.js';

export async function loadBalanceSheet() {
    try {
        const response = await fetch(`${API_URL}/balance_sheet/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Generate HTML for balance sheet
        let html = '<div class="balance-sheet">';
        
        // Assets section
        html += '<h3>Assets</h3>';
        html += '<table>';
        html += '<tbody>';
        data.assets.forEach(asset => {
            html += `<tr>
                <td>${asset.name}</td>
                <td class="text-right">${formatCurrency(asset.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Assets</td>
            <td class="text-right">${formatCurrency(data.total_assets)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Liabilities section
        html += '<h3>Liabilities</h3>';
        html += '<table>';
        html += '<tbody>';
        data.liabilities.forEach(liability => {
            html += `<tr>
                <td>${liability.name}</td>
                <td class="text-right">${formatCurrency(liability.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Liabilities</td>
            <td class="text-right">${formatCurrency(data.total_liabilities)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Equity section
        html += '<h3>Equity</h3>';
        html += '<table>';
        html += '<tbody>';
        data.equity_details.forEach(equity => {
            html += `<tr>
                <td>${equity.name}</td>
                <td class="text-right">${formatCurrency(equity.balance)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Equity</td>
            <td class="text-right">${formatCurrency(data.total_equity)}</td>
        </tr>`;
        html += `<tr class="grand-total-row">
            <td>Total Liabilities and Equity</td>
            <td class="text-right">${formatCurrency(data.total_liabilities_and_equity)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        html += '</div>';
        
        document.getElementById('balanceSheet').innerHTML = html;
    } catch (error) {
        console.error('Error loading balance sheet:', error);
        alert('Error loading balance sheet. Please try again.');
    }
}

export async function loadIncomeStatement(startDate, endDate) {
    try {
        const response = await fetch(`${API_URL}/income_statement/?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Generate HTML for income statement
        let html = '<div class="income-statement">';
        
        // Income section
        html += '<h3>Income</h3>';
        html += '<table>';
        html += '<tbody>';
        data.income.forEach(item => {
            html += `<tr>
                <td>${item.name}</td>
                <td class="text-right">${formatCurrency(item.amount)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Income</td>
            <td class="text-right">${formatCurrency(data.total_income)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Expenses section
        html += '<h3>Expenses</h3>';
        html += '<table>';
        html += '<tbody>';
        data.expenses.forEach(item => {
            html += `<tr>
                <td>${item.name}</td>
                <td class="text-right">${formatCurrency(item.amount)}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Expenses</td>
            <td class="text-right">${formatCurrency(data.total_expenses)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Net Income
        html += '<table>';
        html += '<tbody>';
        html += `<tr class="grand-total-row">
            <td>Net Income</td>
            <td class="text-right">${formatCurrency(data.net_income)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        html += '</div>';
        
        document.getElementById('incomeStatement').innerHTML = html;
    } catch (error) {
        console.error('Error loading income statement:', error);
        alert('Error loading income statement. Please try again.');
    }
}

export async function loadTrialBalance() {
    try {
        const response = await fetch(`${API_URL}/trial_balance/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        let html = '<table>';
        html += '<thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>';
        html += '<tbody>';
        
        data.accounts.forEach(account => {
            html += `<tr>
                <td>${account.name}</td>
                <td class="text-right">${account.debit ? formatCurrency(account.debit) : ''}</td>
                <td class="text-right">${account.credit ? formatCurrency(account.credit) : ''}</td>
            </tr>`;
        });
        
        html += `<tr class="total-row">
            <td>Totals</td>
            <td class="text-right">${formatCurrency(data.total_debits)}</td>
            <td class="text-right">${formatCurrency(data.total_credits)}</td>
        </tr>`;
        html += '</tbody></table>';
        
        document.getElementById('trialBalance').innerHTML = html;
    } catch (error) {
        console.error('Error loading trial balance:', error);
        alert('Error loading trial balance. Please try again.');
    }
} 