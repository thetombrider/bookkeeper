// Modal utility functions using Bootstrap

export function showConfirmDialog(message, type = 'delete') {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal fade" id="confirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${type === 'delete' ? 'Confirm Delete' : 'Confirm Action'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn ${type === 'delete' ? 'btn-danger' : 'btn-primary'}" id="confirmButton">
                                ${type === 'delete' ? 'Delete' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
        document.body.appendChild(modalElement);
        
        const modal = new bootstrap.Modal(modalElement);

        modalElement.querySelector('#confirmButton').onclick = () => {
            modal.hide();
            resolve(true);
        };

        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
            resolve(false);
        });

        modal.show();
    });
}

export function showSuccessMessage(message) {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-success border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    const toastElement = new DOMParser().parseFromString(toastHtml, 'text/html').body.firstChild;
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.appendChild(toastElement);
    document.body.appendChild(toastContainer);
    
    const toast = new bootstrap.Toast(toastElement, { delay: 2000 });
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => toastContainer.remove());
}

export function showErrorMessage(message) {
    const modalHtml = `
        <div class="modal fade" id="errorModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Error</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
    document.body.appendChild(modalElement);
    
    const modal = new bootstrap.Modal(modalElement);
    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    modal.show();
}

export function showFormModal(title, content, onConfirm) {
    const modalHtml = `
        <div class="modal fade" id="formModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${typeof content === 'string' ? content : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmButton">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
    if (typeof content === 'object') {
        modalElement.querySelector('.modal-body').appendChild(content);
    }
    document.body.appendChild(modalElement);
    
    const modal = new bootstrap.Modal(modalElement);
    
    modalElement.querySelector('#confirmButton').onclick = () => {
        if (onConfirm()) {
            modal.hide();
        }
    };
    
    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    modal.show();
    
    return modal;
} 