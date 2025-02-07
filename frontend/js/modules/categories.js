import { API_URL } from './config.js';
import { showConfirmDialog, showSuccessMessage, showErrorMessage } from './modal.js';

export let allCategories = [];

export function handleEditCategory(id, name, description) {
    // Fill the form with category data
    const form = document.getElementById('categoryForm');
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    
    if (form && nameInput && descInput) {
        // Add visual feedback class to the form container
        const formContainer = form.closest('.form-container');
        formContainer.classList.add('editing');
        
        // Add editing indicator to form title
        const formTitle = formContainer.querySelector('h3');
        formTitle.textContent = `Edit Category: ${name}`;
        
        // Scroll to form with smooth animation
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Fill form with category data
        nameInput.value = name;
        descInput.value = description || '';
        
        // Update form for edit mode
        form.dataset.editId = id;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = 'Update Category';

        // Add a cancel button if it doesn't exist
        if (!form.querySelector('.cancel-edit-btn')) {
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'cancel-edit-btn';
            cancelButton.textContent = 'Cancel Edit';
            cancelButton.onclick = () => {
                // Reset form and remove editing state
                form.reset();
                form.dataset.editId = '';
                formContainer.classList.remove('editing');
                formTitle.textContent = 'Create Category';
                submitButton.textContent = 'Create Category';
                cancelButton.remove();
            };
            submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
        }
    }
}

export async function handleDeleteCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;

    if (await showConfirmDialog(`Are you sure you want to delete the category "${category.name}"?`)) {
        try {
            await deleteCategory(id);
            showSuccessMessage('Category deleted successfully!');
            
            // Manually update the UI without triggering event listeners
            const row = document.querySelector(`button[data-id="${id}"]`).closest('tr');
            if (row) {
                row.remove();
            }
            
            // Reload categories without triggering delete
            const response = await fetch(`${API_URL}/account-categories/`);
            if (response.ok) {
                allCategories = await response.json();
                updateCategoryDropdown();
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            if (error.message.includes('not found')) {
                showErrorMessage('Category has already been deleted.');
                // Manually update the UI without triggering event listeners
                const row = document.querySelector(`button[data-id="${id}"]`)?.closest('tr');
                if (row) {
                    row.remove();
                }
                // Update allCategories without triggering delete
                const response = await fetch(`${API_URL}/account-categories/`);
                if (response.ok) {
                    allCategories = await response.json();
                    updateCategoryDropdown();
                }
            } else {
                showErrorMessage('Error deleting category: ' + error.message);
            }
        }
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
            // Remove existing event listeners before updating innerHTML
            const oldElement = categoriesList.cloneNode(true);
            categoriesList.parentNode.replaceChild(oldElement, categoriesList);
            
            oldElement.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allCategories.map(category => `
                            <tr>
                                <td>${category.name}</td>
                                <td>${category.description || ''}</td>
                                <td>
                                    <button class="edit-btn" data-action="edit" data-id="${category.id}" 
                                            data-name="${category.name}" 
                                            data-description="${category.description || ''}">
                                        Edit
                                    </button>
                                    <button class="delete-btn" data-action="delete" data-id="${category.id}">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Add event listeners using event delegation
            oldElement.addEventListener('click', async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const action = button.dataset.action;
                const id = button.dataset.id;
                
                if (action === 'edit') {
                    const name = button.dataset.name;
                    const description = button.dataset.description;
                    handleEditCategory(id, name, description);
                } else if (action === 'delete') {
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

export async function createCategory(event) {
    event.preventDefault();
    
    const form = event.target;
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const editId = form.dataset.editId;
    
    const categoryData = {
        name: nameInput.value,
        description: descInput.value
    };
    
    try {
        if (editId) {
            await updateCategory(editId, categoryData);
            
            // Reset form styling and state
            const formContainer = form.closest('.form-container');
            const formTitle = formContainer.querySelector('h3');
            const submitButton = form.querySelector('button[type="submit"]');
            const cancelButton = form.querySelector('.cancel-edit-btn');
            
            // Update visual state
            formContainer.classList.remove('editing');
            formTitle.textContent = 'Create Category';
            submitButton.textContent = 'Create Category';
            
            // Remove cancel button
            if (cancelButton) {
                cancelButton.remove();
            }
            
            // Reset form state
            form.dataset.editId = '';
            form.reset();
            
            showSuccessMessage('Category updated successfully!');
        } else {
            const response = await fetch(`${API_URL}/account-categories/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Error creating category');
            }
            showSuccessMessage('Category created successfully!');
        }
        
        // Clear form and reload categories
        form.reset();
        await loadCategories();
        return true;
    } catch (error) {
        console.error('Error creating/updating category:', error);
        throw error;
    }
}

async function updateCategory(id, categoryData) {
    const response = await fetch(`${API_URL}/account-categories/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
    });
    
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error updating category');
    }
    
    return response.json();
}

export async function deleteCategory(id) {
    const response = await fetch(`${API_URL}/account-categories/${id}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        const data = await response.json();
        let errorMessage;
        
        if (response.status === 404 || (data.detail && data.detail.message && data.detail.message.includes('not found'))) {
            errorMessage = 'Category not found or already deleted';
        } else if (data.detail && typeof data.detail === 'object' && data.detail.message) {
            errorMessage = data.detail.message;
        } else if (data.detail) {
            errorMessage = data.detail;
        } else {
            errorMessage = 'Server error occurred while deleting category';
        }
        
        throw new Error(errorMessage);
    }
    
    return true;
} 