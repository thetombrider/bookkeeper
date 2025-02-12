async function handleGoCardlessSetup(sourceId) {
    try {
        // Get list of banks
        const response = await fetch(`${API_URL}/import-sources/${sourceId}/gocardless-banks`);
        if (!response.ok) throw new Error('Failed to fetch banks');
        const banks = await response.json();

        // Create modal content for bank selection
        const modalContent = `
            <div class="modal-header">
                <h5 class="modal-title">Select Your Bank</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <input type="text" class="form-control" id="bankSearch" placeholder="Search banks...">
                </div>
                <div class="list-group" id="banksList">
                    ${banks.map(bank => `
                        <button type="button" class="list-group-item list-group-item-action bank-item" 
                                data-bank-id="${bank.id}">
                            ${bank.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Show modal
        const modal = showModal(modalContent);

        // Add search functionality
        const searchInput = modal.querySelector('#bankSearch');
        const banksList = modal.querySelector('#banksList');
        const bankItems = banksList.querySelectorAll('.bank-item');

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            bankItems.forEach(item => {
                const bankName = item.textContent.toLowerCase();
                item.style.display = bankName.includes(searchTerm) ? 'block' : 'none';
            });
        });

        // Handle bank selection
        banksList.addEventListener('click', async (e) => {
            const bankItem = e.target.closest('.bank-item');
            if (!bankItem) return;

            const bankId = bankItem.dataset.bankId;

            try {
                // Create requisition
                const reqResponse = await fetch(
                    `${API_URL}/import-sources/${sourceId}/gocardless-requisition`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bank_id: bankId })
                    }
                );

                if (!reqResponse.ok) throw new Error('Failed to create requisition');
                const { link } = await reqResponse.json();

                // Update modal content with instructions
                modal.querySelector('.modal-content').innerHTML = `
                    <div class="modal-header">
                        <h5 class="modal-title">Connect to Your Bank</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Please follow these steps:</p>
                        <ol>
                            <li>Click the button below to open your bank's login page</li>
                            <li>Log in to your bank account</li>
                            <li>Authorize access to your account data</li>
                            <li>Return to this page and click "Check Connection"</li>
                        </ol>
                        <div class="d-grid gap-2">
                            <a href="${link}" target="_blank" class="btn btn-primary">
                                Open Bank Login
                            </a>
                            <button type="button" class="btn btn-secondary" id="checkConnection">
                                Check Connection
                            </button>
                        </div>
                    </div>
                `;

                // Handle connection check
                modal.querySelector('#checkConnection').addEventListener('click', async () => {
                    try {
                        const accountsResponse = await fetch(
                            `${API_URL}/import-sources/${sourceId}/gocardless-accounts`
                        );
                        
                        if (!accountsResponse.ok) {
                            throw new Error('Connection not established yet');
                        }

                        const accounts = await accountsResponse.json();
                        
                        // Show success message with account info
                        modal.querySelector('.modal-content').innerHTML = `
                            <div class="modal-header">
                                <h5 class="modal-title">Connection Successful</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-success">
                                    Successfully connected to your bank account!
                                </div>
                                <h6>Connected Accounts:</h6>
                                <ul>
                                    ${accounts.map(acc => `
                                        <li>${acc.name} (${acc.iban})</li>
                                    `).join('')}
                                </ul>
                                <p>You can now use the Sync button to import transactions.</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                                    Done
                                </button>
                            </div>
                        `;
                    } catch (error) {
                        showError('Please complete the bank authorization first');
                    }
                });

            } catch (error) {
                showError('Failed to connect to bank');
                console.error('Bank connection error:', error);
            }
        });

    } catch (error) {
        showError('Failed to load banks');
        console.error('Error loading banks:', error);
    }
}

// Update the handleSync function to handle GoCardless
async function handleSync(sourceId, sourceType) {
    try {
        let endpoint;
        if (sourceType === 'gocardless') {
            endpoint = `${API_URL}/import-sources/${sourceId}/sync-gocardless`;
        } else {
            // Handle other source types...
            return;
        }

        const response = await fetch(endpoint, { method: 'POST' });
        if (!response.ok) throw new Error('Sync failed');
        
        const result = await response.json();
        showSuccess(`Successfully synced ${result.transactions_count} transactions`);
        
    } catch (error) {
        showError('Failed to sync transactions');
        console.error('Sync error:', error);
    }
} 