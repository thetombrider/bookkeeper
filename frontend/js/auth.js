// Auth utilities
const API_URL = 'http://localhost:8000';

const auth = {
    // Get the stored token
    getToken() {
        return localStorage.getItem('token');
    },

    // Store the token
    setToken(token) {
        localStorage.setItem('token', token);
    },

    // Remove the token
    removeToken() {
        localStorage.removeItem('token');
    },

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getToken();
    },

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    },

    // Redirect to home if already authenticated
    redirectIfAuthenticated() {
        if (this.isAuthenticated()) {
            window.location.href = '/index.html';
        }
    },

    // Add auth header to fetch options
    addAuthHeader(options = {}) {
        const token = this.getToken();
        if (!token) return options;

        return {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };
    },

    // Login
    async login(email, password) {
        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'username': email,
                'password': password,
            })
        });

        if (!response.ok) {
            throw new Error('Invalid email or password');
        }

        const data = await response.json();
        this.setToken(data.access_token);
    },

    // Register
    async register(email, password, name) {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                name
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }

        // After successful registration, log the user in
        await this.login(email, password);
    },

    // Logout
    logout() {
        this.removeToken();
        window.location.href = '/login.html';
    }
}; 