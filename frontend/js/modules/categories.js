import { API_URL } from './config.js';
import { createModal, showModal } from './modal.js';

export let allCategories = [];

// Wait for app to be ready before initializing
window.addEventListener('app-ready', () => {
    // Initial load of categories
    loadCategories().catch(console.error);
});

export function handleEditCategory(id, name, description) {
    // Fill the form with category data
    const form = document.getElementById('categoryForm');
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const formContainer = form?.closest('.card');
    const formTitle = formContainer?.querySelector('.card-title');
    const submitButton = form?.querySelector('button[type="submit"]');
    
    if (!form || !nameInput || !descInput || !formContainer || !formTitle || !submitButton) {
        console.error('Required form elements not found');
        return;
    }

    // Queue visual updates for next frame
    requestAnimationFrame(() => {
        // Add visual feedback class to the form container
        formContainer.classList.add('editing');
        
        // Update form elements
        formTitle.textContent = `Edit Category: ${name}`;
        nameInput.value = name;
        descInput.value = description || '';
        form.dataset.editId = id;
        submitButton.textContent = 'Update Category';

        // Add cancel button if needed
        if (!form.querySelector('.cancel-edit-btn')) {
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn btn-light ms-2 cancel-edit-btn';
            cancelButton.textContent = 'Cancel';
            cancelButton.onclick = () => {
                // Create and show Bootstrap modal
                const modalHtml = `
                    <div class="modal fade" id="cancelEditModal" tabindex="-1">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Cancel Edit</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <p>Are you sure you want to cancel editing?</p>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">No</button>
                                    <button type="button" class="btn btn-primary" id="confirmCancel">Yes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
                document.body.appendChild(modalElement);
                
                const modal = new bootstrap.Modal(modalElement);
                
                // Handle confirmation
                modalElement.querySelector('#confirmCancel').onclick = () => {
                    requestAnimationFrame(() => {
                        form.reset();
                        form.dataset.editId = '';
                        formContainer.classList.remove('editing');
                        formTitle.textContent = 'Create Category';
                        submitButton.textContent = 'Create Category';
                        cancelButton.remove();
                    });
                    modal.hide();
                    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
                };
                
                modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
                modal.show();
            };
            submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
        }

        // Scroll to form after all updates are complete
        setTimeout(() => {
            const headerOffset = 60;
            const elementPosition = formContainer.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 100);
    });
}

export async function handleDeleteCategory(id) {
    try {
        console.log('Handling delete for category:', id);
        const category = allCategories.find(c => c.id === id);
        if (!category) {
            throw new Error('Category not found');
        }

        // Create Bootstrap modal for confirmation
        const modalHtml = `
            <div class="modal fade" id="deleteCategoryModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Delete Category</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Are you sure you want to delete the category "${category.name}"?</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmDelete">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalElement = new DOMParser().parseFromString(modalHtml, 'text/html').body.firstChild;
        document.body.appendChild(modalElement);
        
        const modal = new bootstrap.Modal(modalElement);

        return new Promise((resolve) => {
            modalElement.querySelector('#confirmDelete').onclick = async () => {
                modal.hide();
                
                try {
                    console.log('Sending delete request for category:', id);
                    const response = await fetch(`${API_URL}/account-categories/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete category');
                    }

                    // Show success toast using Bootstrap toast
                    const toastHtml = `
                        <div class="toast align-items-center text-white bg-success border-0" role="alert">
                            <div class="d-flex">
                                <div class="toast-body">
                                    Category deleted successfully!
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

                    // Reload categories
                    await loadCategories();
                    resolve(true);
                } catch (error) {
                    console.error('Error deleting category:', error);
                    
                    // Show error modal using Bootstrap modal
                    const errorModalHtml = `
                        <div class="modal fade" id="errorModal" tabindex="-1">
                            <div class="modal-dialog">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">Error</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body">
                                        <p>${error.message}</p>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    const errorModalElement = new DOMParser().parseFromString(errorModalHtml, 'text/html').body.firstChild;
                    document.body.appendChild(errorModalElement);
                    
                    const errorModal = new bootstrap.Modal(errorModalElement);
                    errorModalElement.addEventListener('hidden.bs.modal', () => errorModalElement.remove());
                    errorModal.show();
                    
                    resolve(false);
                }
            };

            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                resolve(false);
            });

            modal.show();
        });
    } catch (error) {
        console.error('Error in delete process:', error);
        
        // Show error modal using Bootstrap modal
        const errorModalHtml = `
            <div class="modal fade" id="errorModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Error</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${error.message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const errorModalElement = new DOMParser().parseFromString(errorModalHtml, 'text/html').body.firstChild;
        document.body.appendChild(errorModalElement);
        
        const errorModal = new bootstrap.Modal(errorModalElement);
        errorModalElement.addEventListener('hidden.bs.modal', () => errorModalElement.remove());
        errorModal.show();
    }
}

export async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/account-categories/`);
        if (!response.ok) {
            throw new Error('Failed to load categories');
        }
        allCategories = await response.json();
        
        // Update categories list if the element exists
        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            // First, remove any existing event listeners
            categoriesList.replaceWith(categoriesList.cloneNode(true));
            
            // Get the fresh reference after replacing
            const freshList = document.getElementById('categoriesList');
            
            // Update the HTML content
            freshList.innerHTML = `
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            <th style="width: 25%">Name</th>
                            <th style="width: 50%">Description</th>
                            <th class="text-end" style="width: 25%">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allCategories.map(category => `
                            <tr>
                                <td>${category.name}</td>
                                <td>${category.description || ''}</td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${category.id}" 
                                            data-name="${category.name}" 
                                            data-description="${category.description || ''}">
                                        <i class="bi bi-pencil"></i> Edit
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${category.id}">
                                        <i class="bi bi-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Add new event listener
            freshList.addEventListener('click', async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const id = button.dataset.id;
                
                if (action === 'edit') {
                    const name = button.dataset.name;
                    const description = button.dataset.description;
                    handleEditCategory(id, name, description);
                } else if (action === 'delete') {
                    console.log('Delete button clicked for category:', id);
                    await handleDeleteCategory(id);
                }
            });
        }
        
        // Update category dropdown in accounts section if needed
        updateCategoryDropdown();
        return true;
    } catch (error) {
        console.error('Error loading categories:', error);
        throw error;
    }
}

export function updateCategoryDropdown() {
    const accountType = document.getElementById('accountType');
    const categorySelect = document.getElementById('accountCategory');
    
    // If either element doesn't exist, return early
    if (!categorySelect) {
        return;
    }
    
    const isEditMode = accountType ? accountType.disabled : false;
    
    // In edit mode or when account type is selected, enable and populate the category dropdown
    if (isEditMode || (accountType && accountType.value)) {
        categorySelect.innerHTML = `
            <option value="">Select a category</option>
            ${allCategories.map(category => `
                <option value="${category.id}">${category.name}</option>
            `).join('')}
        `;
        categorySelect.disabled = false;
    } else {
        categorySelect.disabled = true;
        categorySelect.innerHTML = '<option value="">Select account type first</option>';
    }
}

export async function createCategory(formData) {
    try {
        const response = await fetch(`${API_URL}/account-categories/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to create category');
        }

        // Show success toast
        const toastHtml = `
            <div class="toast align-items-center text-white bg-success border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        Category created successfully!
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

        await loadCategories();
    } catch (error) {
        console.error('Error creating category:', error);
        
        // Show error modal
        const errorModalHtml = `
            <div class="modal fade" id="errorModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Error</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${error.message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const errorModalElement = new DOMParser().parseFromString(errorModalHtml, 'text/html').body.firstChild;
        document.body.appendChild(errorModalElement);
        
        const errorModal = new bootstrap.Modal(errorModalElement);
        errorModalElement.addEventListener('hidden.bs.modal', () => errorModalElement.remove());
        errorModal.show();
        
        throw error;
    }
}

export async function updateCategory(id, formData) {
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to update category');
        }

        // Show success toast
        const toastHtml = `
            <div class="toast align-items-center text-white bg-success border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        Category updated successfully!
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

        // Reset form state
        requestAnimationFrame(() => {
            const form = document.getElementById('categoryForm');
            const formContainer = form.closest('.card');
            const formTitle = formContainer.querySelector('.card-title');
            const submitButton = form.querySelector('button[type="submit"]');
            const cancelButton = form.querySelector('.cancel-edit-btn');
            
            formContainer.classList.remove('editing');
            formTitle.textContent = 'Create Category';
            submitButton.textContent = 'Create Category';
            if (cancelButton) cancelButton.remove();
            form.dataset.editId = '';
            form.reset();
        });

        // Reload categories
        await loadCategories();
    } catch (error) {
        console.error('Error updating category:', error);
        
        // Show error modal
        const errorModalHtml = `
            <div class="modal fade" id="errorModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Error</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${error.message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const errorModalElement = new DOMParser().parseFromString(errorModalHtml, 'text/html').body.firstChild;
        document.body.appendChild(errorModalElement);
        
        const errorModal = new bootstrap.Modal(errorModalElement);
        errorModalElement.addEventListener('hidden.bs.modal', () => errorModalElement.remove());
        errorModal.show();
        
        throw error;
    }
} 