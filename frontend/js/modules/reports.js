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
        
        // Generate HTML for balance sheet with Bootstrap grid
        let html = `
            <div class="row">
                <!-- Assets Column -->
                <div class="col-md-6">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="card-title">Assets</h5>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <tbody>
                                        ${data.assets.map(asset => `
                                            <tr>
                                                <td>${asset.name}</td>
                                                <td class="text-end numeric">${formatCurrency(asset.balance)}</td>
                                            </tr>
                                        `).join('')}
                                        <tr class="table-light fw-bold">
                                            <td>Total Assets</td>
                                            <td class="text-end numeric">${formatCurrency(data.total_assets)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <!-- Liabilities Section -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="card-title">Liabilities</h5>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <tbody>
                                        ${data.liabilities.map(liability => `
                                            <tr>
                                                <td>${liability.name}</td>
                                                <td class="text-end numeric">${formatCurrency(liability.balance)}</td>
                                            </tr>
                                        `).join('')}
                                        <tr class="table-light fw-bold">
                                            <td>Total Liabilities</td>
                                            <td class="text-end numeric">${formatCurrency(data.total_liabilities)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Equity Section -->
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title">Equity</h5>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <tbody>
                                        ${data.equity.map(equity => `
                                            <tr>
                                                <td>${equity.name}</td>
                                                <td class="text-end numeric">${formatCurrency(equity.balance)}</td>
                                            </tr>
                                        `).join('')}
                                        <tr class="table-light fw-bold">
                                            <td>Total Equity</td>
                                            <td class="text-end numeric">${formatCurrency(data.total_equity)}</td>
                                        </tr>
                                        <tr class="table-primary fw-bold">
                                            <td>Total Liabilities and Equity</td>
                                            <td class="text-end numeric">${formatCurrency(data.total_liabilities_and_equity)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        
        document.getElementById('accountsTable').innerHTML = html;
    } catch (error) {
        console.error('Error loading balance sheet:', error);
        document.getElementById('accountsTable').innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Error loading balance sheet. Please try again.
            </div>
        `;
    }
}

export async function loadIncomeStatement(startDate, endDate) {
    try {
        const response = await fetch(`${API_URL}/income-statement/?start_date=${startDate}&end_date=${endDate}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Income Statement Data:', data);

        // Ensure data has the expected structure
        const income = data.income || [];
        const expenses = data.expenses || [];
        const totalIncome = data.total_income || 0;
        const totalExpenses = data.total_expenses || 0;
        const netIncome = data.net_income || 0;
        
        // Generate HTML for income statement
        let html = '<div class="row">';
        
        // Income section
        html += `
            <div class="col-12 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Income</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <tbody>`;
        
        if (income.length === 0) {
            html += `<tr><td colspan="2" class="text-center text-muted">No income entries for this period</td></tr>`;
        } else {
            income.forEach(item => {
                const amount = Math.abs(item.balance || 0);
                html += `
                    <tr>
                        <td>${item.name}</td>
                        <td class="text-end numeric">${formatCurrency(amount)}</td>
                    </tr>`;
            });
        }
        
        html += `
                                    <tr class="table-light fw-bold">
                                        <td>Total Income</td>
                                        <td class="text-end numeric">${formatCurrency(Math.abs(totalIncome))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
        
        // Expenses section
        html += `
            <div class="col-12 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Expenses</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <tbody>`;
        
        if (expenses.length === 0) {
            html += `<tr><td colspan="2" class="text-center text-muted">No expense entries for this period</td></tr>`;
        } else {
            expenses.forEach(item => {
                const amount = Math.abs(item.balance || 0);
                html += `
                    <tr>
                        <td>${item.name}</td>
                        <td class="text-end numeric">${formatCurrency(amount)}</td>
                    </tr>`;
            });
        }
        
        html += `
                                    <tr class="table-light fw-bold">
                                        <td>Total Expenses</td>
                                        <td class="text-end numeric">${formatCurrency(Math.abs(totalExpenses))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
        
        // Net Income section
        html += `
            <div class="col-12">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h5 class="card-title mb-0">Net Income</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <tbody>
                                    <tr class="fw-bold">
                                        <td>Net Income for Period</td>
                                        <td class="text-end numeric">${formatCurrency(netIncome)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
        
        html += '</div>';
        
        const container = document.getElementById('incomeStatement');
        if (!container) {
            console.error('Income statement container not found!');
            return;
        }
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading income statement:', error);
        const container = document.getElementById('incomeStatement');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    Error loading income statement. Please try again.
                </div>
            `;
        }
    }
}

export async function loadTrialBalance() {
    try {
        const response = await fetch(`${API_URL}/trial_balance/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        let html = `
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">Trial Balance</h5>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th class="text-end">Debit</th>
                                    <th class="text-end">Credit</th>
                                </tr>
                            </thead>
                            <tbody>`;
        
        data.accounts.forEach(account => {
            html += `
                <tr>
                    <td>${account.name}</td>
                    <td class="text-end numeric">${account.debit ? formatCurrency(account.debit) : ''}</td>
                    <td class="text-end numeric">${account.credit ? formatCurrency(account.credit) : ''}</td>
                </tr>`;
        });
        
        html += `
                                <tr class="table-light fw-bold">
                                    <td>Totals</td>
                                    <td class="text-end numeric">${formatCurrency(data.total_debits)}</td>
                                    <td class="text-end numeric">${formatCurrency(data.total_credits)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        
        document.getElementById('trialBalance').innerHTML = html;
    } catch (error) {
        console.error('Error loading trial balance:', error);
        document.getElementById('trialBalance').innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Error loading trial balance. Please try again.
            </div>
        `;
    }
} 