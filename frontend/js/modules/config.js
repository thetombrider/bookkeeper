// Configuration for the application
export const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.host}/api`;

export const formatCurrency = (amount) => {
    // Handle null/undefined
    if (amount === null || amount === undefined) {
        return '€0,00';
    }
    
    // Convert to number if it's a string
    const num = typeof amount === 'string' ? Number(amount) : amount;
    
    // Check if it's a valid number
    if (typeof num !== 'number' || isNaN(num)) {
        console.log('Invalid amount:', amount, typeof amount); // Debug log
        return '€0,00';
    }
    
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

export const parseDecimalNumber = (value) => {
    if (!value) return 0;
    const normalized = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
}; 