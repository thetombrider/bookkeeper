import { loadCategories, createCategory } from '../modules/categories.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load initial categories
        await loadCategories();

        // Set up form submission handler
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await createCategory(event);
                    categoryForm.reset();
                } catch (error) {
                    console.error('Error creating category:', error);
                    alert('Error creating category: ' + error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing categories:', error);
        alert('Error loading categories. Please refresh the page.');
    }
}); 