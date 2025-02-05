import { API_URL, formatCurrency } from './config.js';

export async function loadBalanceSheet(asOfDate = null) {
    try {
        const url = asOfDate 
            ? `${API_URL}/balance-sheet/?as_of=${asOfDate}`
            : `${API_URL}/balance-sheet/`;
            
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Generate HTML for balance sheet with two columns
        let html = `
            <div class="balance-sheet">
                <div class="balance-sheet-column">
                    <!-- Assets section -->
                    <div class="statement-section">
                        <h3>Assets</h3>
                        <table>
                            <tbody>
                                ${data.assets.map(asset => `
                                    <tr>
                                        <td>${asset.name}</td>
                                        <td class="text-right">${formatCurrency(asset.balance)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td>Total Assets</td>
                                    <td class="text-right">${formatCurrency(data.total_assets)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="balance-sheet-column">
                    <!-- Liabilities section -->
                    <div class="statement-section">
                        <h3>Liabilities</h3>
                        <table>
                            <tbody>
                                ${data.liabilities.map(liability => `
                                    <tr>
                                        <td>${liability.name}</td>
                                        <td class="text-right">${formatCurrency(liability.balance)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td>Total Liabilities</td>
                                    <td class="text-right">${formatCurrency(data.total_liabilities)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Equity section -->
                    <div class="statement-section">
                        <h3>Equity</h3>
                        <table>
                            <tbody>
                                ${data.equity.map(equity => `
                                    <tr>
                                        <td>${equity.name}</td>
                                        <td class="text-right">${formatCurrency(equity.balance)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td>Total Equity</td>
                                    <td class="text-right">${formatCurrency(data.total_equity)}</td>
                                </tr>
                                <tr class="grand-total-row">
                                    <td>Total Liabilities and Equity</td>
                                    <td class="text-right">${formatCurrency(data.total_liabilities_and_equity)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        
        document.getElementById('accountsTable').innerHTML = html;
    } catch (error) {
        console.error('Error loading balance sheet:', error);
        alert('Error loading balance sheet. Please try again.');
    }
}

export async function loadIncomeStatement(startDate, endDate) {
    try {
        const response = await fetch(`${API_URL}/income-statement/?start_date=${startDate}&end_date=${endDate}`);
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
            // Only format if the amount exists and is a number
            const amount = typeof item.amount === 'number' ? item.amount : null;
            html += `<tr>
                <td>${item.name}</td>
                <td class="text-right">${amount !== null ? formatCurrency(amount) : '—'}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Income</td>
            <td class="text-right">${typeof data.total_income === 'number' ? formatCurrency(data.total_income) : '—'}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Expenses section
        html += '<h3>Expenses</h3>';
        html += '<table>';
        html += '<tbody>';
        data.expenses.forEach(item => {
            // Only format if the amount exists and is a number
            const amount = typeof item.amount === 'number' ? item.amount : null;
            html += `<tr>
                <td>${item.name}</td>
                <td class="text-right">${amount !== null ? formatCurrency(amount) : '—'}</td>
            </tr>`;
        });
        html += `<tr class="total-row">
            <td>Total Expenses</td>
            <td class="text-right">${typeof data.total_expenses === 'number' ? formatCurrency(data.total_expenses) : '—'}</td>
        </tr>`;
        html += '</tbody></table>';
        
        // Net Income
        html += '<table>';
        html += '<tbody>';
        html += `<tr class="grand-total-row">
            <td>Net Income</td>
            <td class="text-right">${typeof data.net_income === 'number' ? formatCurrency(data.net_income) : '—'}</td>
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