// Direct service for market data that explicitly uses the backend URL

// Define the backend URL - ensure it points to the Render deployment
const BACKEND_URL = "https://trading-app-backend-t9k9.onrender.com/api";

// Helper function for making requests with proper error handling
const fetchWithErrorHandling = async (url, options = {}) => {
  console.log(`Fetching from: ${url}`);
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request error: ${error.message}`);
    throw error;
  }
};

// Get current price for a symbol
export const getCurrentPrice = async (symbol) => {
  try {
    // Use the market/price endpoint from the backend
    const url = `${BACKEND_URL}/market/price/${symbol}`;
    return await fetchWithErrorHandling(url);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}: ${error.message}`);
    throw new Error(`Failed to fetch price for ${symbol}`);
  }
};

// Get candles data for a symbol
export const getCandles = async (symbol, interval, limit = 1000) => {
  try {
    // Use the market/candles endpoint from the backend
    const url = `${BACKEND_URL}/market/candles/${symbol}?interval=${interval}&limit=${limit}`;
    return await fetchWithErrorHandling(url);
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}: ${error.message}`);
    throw new Error(`Failed to fetch candles for ${symbol}`);
  }
};

// Get market data for multiple symbols
export const getMarketData = async (symbols = []) => {
  try {
    // Use a Promise.all to fetch prices for multiple symbols in parallel
    const pricePromises = symbols.map(symbol => getCurrentPrice(symbol));
    const prices = await Promise.all(pricePromises);
    
    return prices.reduce((acc, data, index) => {
      acc[symbols[index]] = data;
      return acc;
    }, {});
  } catch (error) {
    console.error(`Error fetching market data: ${error.message}`);
    throw new Error('Failed to fetch market data');
  }
};

export default {
  getCurrentPrice,
  getCandles,
  getMarketData
};
