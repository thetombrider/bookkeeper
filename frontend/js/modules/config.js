export const API_URL = 'http://localhost:8000';

export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
};

export const parseDecimalNumber = (value) => {
    if (!value) return 0;
    const normalized = value.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
}; 