import { API_URL } from './config.js';

export let allCategories = [];

export async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/account-categories/`);
        allCategories = await response.json();
        
        // Update categories list if the element exists
        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            categoriesList.innerHTML = `
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
                                    <button data-action="edit" data-id="${category.id}" 
                                            data-name="${category.name}" 
                                            data-description="${category.description || ''}">
                                        Edit
                                    </button>
                                    <button data-action="delete" data-id="${category.id}">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Add event listeners for edit and delete buttons
            categoriesList.querySelectorAll('button[data-action]').forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    const id = e.target.dataset.id;
                    
                    if (action === 'edit') {
                        const name = e.target.dataset.name;
                        const description = e.target.dataset.description;
                        handleEditCategory(id, name, description);
                    } else if (action === 'delete') {
                        handleDeleteCategory(id);
                    }
                });
            });
        }
        
        // Update category dropdown in accounts section if needed
        updateCategoryDropdown();
        return allCategories;
    } catch (error) {
        console.error('Error loading categories:', error);
        throw error;
    }
}

function handleEditCategory(id, name, description) {
    // Fill the form with category data
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const form = document.getElementById('categoryForm');
    
    if (nameInput && descInput && form) {
        nameInput.value = name;
        descInput.value = description;
        
        // Update form to handle edit instead of create
        form.dataset.editId = id;
        
        // Change button text
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Update Category';
        }
    }
}

async function handleDeleteCategory(id) {
    if (confirm('Are you sure you want to delete this category?')) {
        try {
            await deleteCategory(id);
            await loadCategories();
        } catch (error) {
            alert('Error deleting category: ' + error.message);
        }
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
    const selectedType = accountType ? accountType.value : null;
    
    if (!selectedType && !isEditMode) {
        categorySelect.disabled = true;
        categorySelect.innerHTML = '<option value="">Select account type first</option>';
        return;
    }
    
    categorySelect.innerHTML = `
        <option value="">Select a category</option>
        ${allCategories.map(category => `
            <option value="${category.id}">${category.name}</option>
        `).join('')}
    `;
    categorySelect.disabled = false;
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
            // Update existing category
            await updateCategory(editId, categoryData);
            // Reset form state
            form.dataset.editId = '';
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.textContent = 'Create Category';
            }
        } else {
            // Create new category
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
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail?.message || data.detail || 'Cannot delete this category.');
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
    }
} 