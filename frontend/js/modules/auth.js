// Auth utilities
const API_URL = 'http://localhost:8000';

export const auth = {
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
        localStorage.removeItem('user');
    },

    // Check if user is authenticated
    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;
        
        // Check if token is expired
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                this.removeToken();
                return false;
            }
            return true;
        } catch (e) {
            this.removeToken();
            return false;
        }
    },

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
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
        if (!token) {
            this.logout();
            return options;
        }

        return {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };
    },

    // Get current user
    async getCurrentUser() {
        try {
            // Check if we have user data in localStorage
            const cachedUser = localStorage.getItem('user');
            if (cachedUser) {
                return JSON.parse(cachedUser);
            }

            // If not, fetch from API
            const response = await fetch(`${API_URL}/users/me`, this.addAuthHeader());
            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return null;
                }
                throw new Error('Failed to get user data');
            }

            const user = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            return user;
        } catch (error) {
            console.error('Error getting current user:', error);
            if (error.message.includes('401')) {
                this.logout();
            }
            return null;
        }
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

        // Get and cache user data
        await this.getCurrentUser();
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