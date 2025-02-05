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
                                    <button onclick="editCategory('${category.id}', '${category.name}', '${category.description || ''}')">Edit</button>
                                    <button onclick="deleteCategory('${category.id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // Update category dropdown in accounts section if needed
        updateCategoryDropdown();
        return allCategories;
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
    
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    
    const categoryData = {
        name: nameInput.value,
        description: descInput.value
    };
    
    try {
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
        
        // Clear form and reload categories
        event.target.reset();
        await loadCategories();
        
        return true;
    } catch (error) {
        console.error('Error creating category:', error);
        throw error;
    }
}

export async function updateCategory(event, id) {
    event.preventDefault();
    
    const categoryData = {
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value
    };
    
    try {
        const response = await fetch(`${API_URL}/account-categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error updating category:', error);
        throw error;
    }
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
        
        await loadCategories();
        return true;
    } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
    }
} 