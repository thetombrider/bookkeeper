document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    auth.redirectIfAuthenticated();

    const registerForm = document.getElementById('registerForm');
    const errorAlert = document.getElementById('errorAlert');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide any previous error
        errorAlert.classList.add('d-none');
        
        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // Attempt to register
            await auth.register(email, password, name);
            
            // Redirect to home page on success
            window.location.href = '/index.html';
        } catch (error) {
            // Show error message
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
        }
    });
}); 