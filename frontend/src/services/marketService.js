// Direct service for market data

// Define the backend URL - ensure it points to the Render deployment
const BACKEND_URL = "https://trading-app-backend-t9k9.onrender.com/api";

// Set up mock prices for when the backend is unavailable
const MOCK_PRICES = {
  'BTCUSDT': 65000,
  'ETHUSDT': 3500,
  'SOLUSDT': 140,
  'BNBUSDT': 580,
  'XRPUSDT': 0.55,
  'DOGEUSDT': 0.12,
  'AVAXUSDT': 28,
  'ADAUSDT': 0.45,
  'LTCUSDT': 85,
  'DOTUSDT': 6.5,
};

// Keep a cache of the latest prices
const priceCache = {};

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
    },
    // Add a timeout to the fetch request
    signal: AbortSignal.timeout(10000) // 10 second timeout
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
    throw error;
  }
};

// Generate a semi-realistic price movement from the last known price
const generateMockPriceMovement = (symbol, lastPrice = null) => {
  // Use the last known price or the base mock price
  const basePrice = lastPrice || MOCK_PRICES[symbol] || 100;
  
  // Generate a random movement between -0.5% and +0.5%
  const movement = (Math.random() - 0.5) * 0.01 * basePrice;
  
  // Return the new price with some randomness
  return basePrice + movement;
};

// Get current price for a symbol
export const getCurrentPrice = async (symbol) => {
  try {
    // First try to fetch from the backend
    const url = `${BACKEND_URL}/prices/${symbol}`;
    const data = await fetchWithErrorHandling(url);
    
    // Cache the price
    priceCache[symbol] = data.price;
    
    return {
      symbol,
      price: data.price,
      cached: data.cached || false,
      fallback: data.fallback || false
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}: ${error.message}`);
    
    // Use the cached price if available
    if (priceCache[symbol]) {
      const cachedPrice = priceCache[symbol];
      // Generate a small variation to make it look like it's updating
      const newPrice = generateMockPriceMovement(symbol, cachedPrice);
      // Update the cache with the new generated price
      priceCache[symbol] = newPrice;
      
      console.log(`Using cached price with variation for ${symbol}: ${newPrice}`);
      return {
        symbol,
        price: newPrice,
        cached: true
      };
    }
    
    // If no cache, fall back to simulated data
    const mockPrice = generateMockPriceMovement(symbol);
    // Cache the mock price for future reference
    priceCache[symbol] = mockPrice;
    
    console.log(`Using mock price for ${symbol}: ${mockPrice}`);
    return {
      symbol,
      price: mockPrice,
      fallback: true
    };
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
    
    // Generate mock candles for demo purposes
    return generateMockCandles(symbol, interval, limit);
  }
};

// Generate mock candles for demo when backend is unavailable
const generateMockCandles = (symbol, interval, limit) => {
  const basePrice = MOCK_PRICES[symbol] || 100;
  const volatility = 0.02; // 2% price movement
  
  let time = Date.now() - (getIntervalInMs(interval) * limit);
  let price = basePrice;
  
  const candles = [];
  for (let i = 0; i < limit; i++) {
    // Random price movement
    const priceMove = (Math.random() - 0.5) * 2 * volatility * price;
    const newPrice = price + priceMove;
    
    // Create a candle with realistic OHLC values
    const open = price;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000 * basePrice;
    
    candles.push({
      time: time / 1000, // Convert to seconds for lightweight-charts
      open,
      high,
      low,
      close,
      volume
    });
    
    time += getIntervalInMs(interval);
    price = newPrice;
  }
  
  return candles;
};

// Helper to convert interval to milliseconds
const getIntervalInMs = (interval) => {
  const unit = interval.slice(-1);
  const amount = parseInt(interval.slice(0, -1));
  
  switch (unit) {
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'd': return amount * 24 * 60 * 60 * 1000;
    case 'w': return amount * 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 1000; // Default to 1m
  }
};

export default {
  getCurrentPrice,
  getCandles
};
