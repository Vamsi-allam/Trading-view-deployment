import api from './api';

// Define the backend URL - ensure it points to the Render deployment
const BACKEND_URL = "https://trading-app-backend-t9k9.onrender.com/api";

// Helper function to fetch with proper error handling
const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
};

// Get current price for a symbol
export const getCurrentPrice = async (symbol) => {
  try {
    // Directly use the backend URL instead of relying on relative paths
    const url = `${BACKEND_URL}/market/price/${symbol}`;
    console.log(`Fetching price from: ${url}`);
    return await fetchWithErrorHandling(url);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
};

// Get candles data for a symbol
export const getCandles = async (symbol, interval, limit = 1000) => {
  try {
    // Directly use the backend URL instead of relying on relative paths
    const url = `${BACKEND_URL}/market/candles/${symbol}?interval=${interval}&limit=${limit}`;
    console.log(`Fetching candles from: ${url}`);
    return await fetchWithErrorHandling(url);
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}:`, error);
    throw error;
  }
};

// Optional WebSocket connection for real-time price updates
export const connectToPriceFeed = (symbol, onPriceUpdate) => {
  // WebSocket connection for real-time price updates
  // Use wss:// for secure WebSocket connections
  const wsUrl = `wss://trading-app-backend-t9k9.onrender.com/api/ws/prices/${symbol}`;
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log(`WebSocket connection established for ${symbol}`);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onPriceUpdate(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log(`WebSocket connection closed for ${symbol}`);
  };
  
  // Return a function to close the connection
  return () => {
    ws.close();
  };
};

// Other market-related functions can be added here

export default {
  getCurrentPrice,
  getCandles,
  connectToPriceFeed,
};
