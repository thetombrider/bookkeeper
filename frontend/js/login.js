document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    auth.redirectIfAuthenticated();

    const loginForm = document.getElementById('loginForm');
    const errorAlert = document.getElementById('errorAlert');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide any previous error
        errorAlert.classList.add('d-none');
        
        // Get form values
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // Attempt to login
            await auth.login(email, password);
            
            // Redirect to home page on success
            window.location.href = '/index.html';
        } catch (error) {
            // Show error message
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
        }
    });
}); 