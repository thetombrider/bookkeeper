import { loadCategories, createCategory, updateCategory, handleEditCategory, handleDeleteCategory } from '../modules/categories.js';
import { showSuccessMessage, showErrorMessage, showConfirmDialog } from '../modules/modal.js';
import { auth } from '../modules/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    auth.requireAuth();
    
    try {
        // Load initial categories
        await loadCategories();

        // Set up form submission handler
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const formData = {
                        name: document.getElementById('categoryName').value.trim(),
                        description: document.getElementById('categoryDescription').value.trim()
                    };

                    if (!formData.name) {
                        const errorModal = createModal('delete', 'Error');
                        showModal(errorModal, 'Category name is required');
                        return;
                    }

                    const editId = categoryForm.dataset.editId;
                    if (editId) {
                        await updateCategory(editId, formData);
                        
                        // Reset form state
                        const formContainer = categoryForm.closest('.card');
                        const formTitle = formContainer.querySelector('.card-title');
                        const submitButton = categoryForm.querySelector('button[type="submit"]');
                        const cancelButton = categoryForm.querySelector('.cancel-edit-btn');
                        
                        formContainer.classList.remove('editing');
                        formTitle.textContent = 'Create Category';
                        submitButton.textContent = 'Create Category';
                        if (cancelButton) cancelButton.remove();
                        
                        categoryForm.dataset.editId = '';
                    } else {
                        await createCategory(formData);
                    }

                    // Reset form and reload categories
                    categoryForm.reset();
                    await loadCategories();
                } catch (error) {
                    console.error('Error handling category:', error);
                    const errorModal = createModal('delete', 'Error');
                    showModal(errorModal, error.message);
                }
            });
        }

        // Set up event delegation for categories list
        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            categoriesList.addEventListener('click', async (e) => {
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
    } catch (error) {
        console.error('Error initializing categories:', error);
        const errorModal = createModal('delete', 'Error');
        showModal(errorModal, 'Error loading categories. Please refresh the page.');
    }
}); 