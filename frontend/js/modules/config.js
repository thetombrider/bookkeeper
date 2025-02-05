export const API_URL = 'http://localhost:8000';

export const formatCurrency = (amount) => {
    // Only format if it's actually a number
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '—';
    }
    
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const parseDecimalNumber = (value) => {
    if (!value) return 0;
    const normalized = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
}; 