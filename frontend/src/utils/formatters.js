/**
 * Determines the appropriate decimal precision based on price value and symbol
 * @param {number} price - The price value to format
 * @param {string} symbol - The trading symbol (e.g., 'BTCUSDT', 'XRPUSDT')
 * @returns {number} - The number of decimal places to use
 */
export const getDecimalPrecision = (price, symbol = '') => {
  // Symbol-specific precision
  if (symbol) {
    if (symbol === 'DOGEUSDT') return 5;
    if (symbol === 'XRPUSDT') return 4;
    if (symbol === 'BTCUSDT') return 1;
    if (symbol === 'ETHUSDT') return 2;
    if (symbol === 'BCHUSDT') return 2;
    if (symbol === 'ADAUSDT') return 4;
  }
  
  // Generic precision based on price range
  if (price < 0.0001) return 8;
  if (price < 0.01) return 6;
  if (price < 1) return 5;
  if (price < 10) return 4;  // XRP range
  if (price < 100) return 3;
  if (price < 1000) return 2;
  return 2;
};

/**
 * Formats a price with the appropriate number of decimal places
 * @param {number} price - The price to format
 * @param {string} symbol - The trading symbol (optional)
 * @returns {string} - The formatted price string
 */
export const formatPrice = (price, symbol = '') => {
  if (price === null || price === undefined) return '--';
  
  const precision = getDecimalPrecision(price, symbol);
  return parseFloat(price).toFixed(precision);
};
