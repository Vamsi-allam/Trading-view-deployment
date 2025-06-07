// Direct service for market data

// Define the backend URL - ensure it points to the Render deployment
const BACKEND_URL = "https://trading-app-backend-t9k9.onrender.com/api";

// Helper function for making requests with proper error handling
const fetchWithErrorHandling = async (url, options = {}) => {
  console.log(`Fetching from: ${url}`);
  
  // Add CORS mode to request
  const fetchOptions = {
    ...options,
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request error: ${error.message}`);
    
    // Fall back to simulated data for development
    if (url.includes('/prices/')) {
      const symbol = url.split('/').pop();
      console.log(`Falling back to simulated price data for ${symbol}`);
      return simulatePriceData(symbol);
    }
    
    throw error;
  }
};

// Fallback function to simulate price data when API fails
const simulatePriceData = (symbol) => {
  const basePrice = {
    'BTCUSDT': 65000,
    'ETHUSDT': 3500,
    'SOLUSDT': 140,
    'BNBUSDT': 580
  }[symbol] || 100;
  
  // Add some random variation
  const randomFactor = 0.995 + (Math.random() * 0.01);
  return {
    symbol,
    price: basePrice * randomFactor
  };
};

// Get current price for a symbol
export const getCurrentPrice = async (symbol) => {
  try {
    // Use the market/price endpoint from the backend
    const url = `${BACKEND_URL}/prices/${symbol}`;
    return await fetchWithErrorHandling(url);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}: ${error.message}`);
    return simulatePriceData(symbol); // Always return simulated data on error
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

export default {
  getCurrentPrice,
  getCandles
};
