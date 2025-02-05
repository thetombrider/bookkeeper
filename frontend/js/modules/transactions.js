import { API_URL, formatCurrency, parseDecimalNumber } from './config.js';
import { allAccounts, loadAccounts } from './accounts.js';

export async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions/`);
        const transactions = await response.json();
        
        // Update transactions list
        const transactionsList = document.getElementById('transactionsList');
        transactionsList.innerHTML = generateTransactionsTable(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        throw error;
    }
}

function generateTransactionsTable(transactions) {
    return `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(transaction => `
                    <tr>
                        <td>${transaction.transaction_date}</td>
                        <td>${transaction.description}</td>
                        <td>${transaction.reference_number || ''}</td>
                        <td>${transaction.status}</td>
                        <td>
                            <button onclick="viewTransaction('${transaction.id}')">View</button>
                            <button onclick="deleteTransaction('${transaction.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export async function addJournalEntryRow() {
    // Ensure accounts are loaded
    if (!allAccounts || allAccounts.length === 0) {
        await loadAccounts();
    }

    const entriesList = document.querySelector('.journal-entries-list');
    const newRow = document.createElement('div');
    newRow.className = 'journal-entry-row';
    newRow.innerHTML = `
        <select class="journal-entry-account" required>
            <option value="">Select an account</option>
            ${allAccounts.map(account => `
                <option value="${account.id}">${account.code} - ${account.name}</option>
            `).join('')}
        </select>
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-debit" 
               onchange="updateTotals()">
        <input type="number" 
               step="0.01" 
               placeholder="0,00" 
               class="journal-entry-credit" 
               onchange="updateTotals()">
        <button type="button" onclick="removeJournalEntry(this)" title="Remove entry">
            <span>×</span>
        </button>
    `;
    
    entriesList.appendChild(newRow);
    updateTotals();
}

export function removeJournalEntry(button) {
    button.closest('.journal-entry-row').remove();
    updateTotals();
}

export function updateTotals() {
    let totalDebits = 0;
    let totalCredits = 0;
    
    document.querySelectorAll('.journal-entry-row').forEach(row => {
        const debit = parseDecimalNumber(row.querySelector('.journal-entry-debit').value) || 0;
        const credit = parseDecimalNumber(row.querySelector('.journal-entry-credit').value) || 0;
        
        totalDebits += debit;
        totalCredits += credit;
    });
    
    document.getElementById('total-debits').textContent = formatCurrency(totalDebits);
    document.getElementById('total-credits').textContent = formatCurrency(totalCredits);
    
    // Highlight totals if they don't match
    const totalsMatch = Math.abs(totalDebits - totalCredits) < 0.01;
    document.getElementById('total-debits').style.color = totalsMatch ? '#333' : '#dc3545';
    document.getElementById('total-credits').style.color = totalsMatch ? '#333' : '#dc3545';
}

export async function createTransaction(transactionData) {
    try {
        const response = await fetch(`${API_URL}/transactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error creating transaction');
        }
        
        const result = await response.json();
        await loadTransactions();
        return result;
    } catch (error) {
        console.error('Error creating transaction:', error);
        throw error;
    }
}

export async function getTransaction(id) {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching transaction:', error);
        throw error;
    }
}

export async function deleteTransaction(id) {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await loadTransactions();
        return true;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        throw error;
    }
} 