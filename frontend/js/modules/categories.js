import { API_URL } from './config.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from './modal.js';
import { auth } from './auth.js';

// State
let allCategories = [];

// Functions
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/account-categories/`, auth.addAuthHeader());
        if (!response.ok) {
            if (response.status === 401) {
                auth.logout();
                return [];
            }
            throw new Error('Failed to load categories');
        }
        allCategories = await response.json();
        
        // Update categories list if the element exists
        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            updateCategoriesList(allCategories);
        }
        
        return allCategories;
    } catch (error) {
        console.error('Error loading categories:', error);
        if (error.message.includes('401')) {
            auth.logout();
            return [];
        }
        showErrorMessage('Error loading categories: ' + error.message);
        return [];
    }
}

function updateCategoriesList(categories) {
    const list = document.getElementById('categoriesList');
    if (!list) return;

    if (!categories || categories.length === 0) {
        list.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    No categories found
                </td>
            </tr>
        `;
        return;
    }

    list.innerHTML = categories.map(category => `
        <tr>
            <td>${category.name}</td>
            <td>${category.description || '-'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-2" 
                        data-action="edit" 
                        data-id="${category.id}"
                        data-name="${category.name}"
                        data-description="${category.description || ''}">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" 
                        data-action="delete" 
                        data-id="${category.id}">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCategoryDropdown() {
    const categorySelect = document.getElementById('accountCategory');
    if (!categorySelect) return;

    categorySelect.innerHTML = `
        <option value="">No category</option>
        ${allCategories.map(category => `
            <option value="${category.id}">${category.name}</option>
        `).join('')}
    `;
}

async function createCategory(formData) {
    try {
        const response = await fetch(`${API_URL}/account-categories/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create category');
        }

        const newCategory = await response.json();
        showSuccessMessage('Category created successfully');
        await loadCategories();
        return newCategory;
    } catch (error) {
        console.error('Error creating category:', error);
        throw error;
    }
}

async function updateCategory(id, formData) {
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...auth.addAuthHeader().headers
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update category');
        }

        const updatedCategory = await response.json();
        showSuccessMessage('Category updated successfully');
        await loadCategories();
        return updatedCategory;
    } catch (error) {
        console.error('Error updating category:', error);
        throw error;
    }
}

async function deleteCategory(id) {
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'DELETE',
            ...auth.addAuthHeader()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete category');
        }

        showSuccessMessage('Category deleted successfully');
        await loadCategories();
        return true;
    } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
    }
}

async function handleEditCategory(id, name, description) {
    const form = document.getElementById('categoryForm');
    if (!form) return;

    form.dataset.editId = id;
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryDescription').value = description || '';

    // Update form appearance
    const formContainer = form.closest('.card');
    const formTitle = formContainer.querySelector('.card-title');
    const submitButton = form.querySelector('button[type="submit"]');
    
    formContainer.classList.add('editing');
    formTitle.textContent = 'Edit Category';
    submitButton.textContent = 'Update Category';

    // Add cancel button if it doesn't exist
    if (!form.querySelector('.cancel-edit-btn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary me-2 cancel-edit-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            form.reset();
            form.dataset.editId = '';
            formContainer.classList.remove('editing');
            formTitle.textContent = 'Create Category';
            submitButton.textContent = 'Create Category';
            cancelBtn.remove();
        };
        submitButton.parentNode.insertBefore(cancelBtn, submitButton);
    }
}

async function handleDeleteCategory(id) {
    const category = allCategories.find(c => c.id === id);
    if (!category) {
        showErrorMessage('Category not found');
        return;
    }

    if (await showConfirmDialog(`Are you sure you want to delete the category "${category.name}"?`)) {
        try {
            await deleteCategory(id);
        } catch (error) {
            showErrorMessage(error.message);
        }
    }
}

// Export all functions at the end of the file
export {
    loadCategories,
    updateCategoryDropdown,
    createCategory,
    updateCategory,
    deleteCategory,
    handleEditCategory,
    handleDeleteCategory,
    allCategories
}; 