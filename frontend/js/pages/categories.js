import { loadCategories, createCategory } from '../modules/categories.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial categories
        await loadCategories();

        // Set up form submission handler
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            // Remove any existing event listeners by cloning and replacing
            const newCategoryForm = categoryForm.cloneNode(true);
            categoryForm.parentNode.replaceChild(newCategoryForm, categoryForm);
            
            newCategoryForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await createCategory(event);
                } catch (error) {
                    console.error('Error handling category:', error);
                    alert('Error: ' + error.message);
                }
            });
        }

        // Set up event delegation for categories list
        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            // Remove any existing event listeners by cloning and replacing
            const newCategoriesList = categoriesList.cloneNode(true);
            categoriesList.parentNode.replaceChild(newCategoriesList, categoriesList);

            // Add single event listener for all category actions
            newCategoriesList.addEventListener('click', async (e) => {
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
        alert('Error loading categories. Please refresh the page.');
    }
}); 