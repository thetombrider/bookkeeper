// Modal utility functions
export function createModal(type, title) {
    const modal = document.createElement('div');
    modal.className = `modal modal-${type}`;
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer">
                ${type === 'delete' ? `
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Delete</button>
                ` : type === 'edit' ? `
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-confirm">Save Changes</button>
                ` : `
                    <button class="btn-confirm">OK</button>
                `}
            </div>
        </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('.btn-cancel');
    
    closeBtn.addEventListener('click', () => hideModal(modal));
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => hideModal(modal));
    }

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modal);
        }
    });

    return modal;
}

export function showModal(modal, content) {
    // Set content
    const modalBody = modal.querySelector('.modal-body');
    if (typeof content === 'string') {
        modalBody.innerHTML = `<div class="modal-message">${content}</div>`;
    } else if (content instanceof HTMLElement) {
        modalBody.innerHTML = '';
        modalBody.appendChild(content);
    }

    // Show modal with animation
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });
}

export function hideModal(modal) {
    modal.classList.remove('show');
    modal.addEventListener('transitionend', () => {
        modal.remove();
    }, { once: true });
}

export function showConfirmDialog(message, type = 'delete') {
    return new Promise((resolve) => {
        const modal = createModal(type, type === 'delete' ? 'Confirm Delete' : 'Confirm Action');
        const confirmBtn = modal.querySelector('.btn-confirm');
        
        modal.querySelector('.modal-body').innerHTML = `
            <div class="modal-message ${type === 'delete' ? 'warning' : ''}">${message}</div>
        `;

        confirmBtn.addEventListener('click', () => {
            hideModal(modal);
            resolve(true);
        });

        modal.querySelector('.btn-cancel').addEventListener('click', () => {
            hideModal(modal);
            resolve(false);
        });

        showModal(modal);
    });
}

export function showSuccessMessage(message) {
    const modal = createModal('success', 'Success');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="modal-message success">${message}</div>
    `;
    showModal(modal);
}

export function showErrorMessage(message) {
    const modal = createModal('delete', 'Error');
    modal.querySelector('.modal-body').innerHTML = `
        <div class="modal-message warning">${message}</div>
    `;
    showModal(modal);
} 