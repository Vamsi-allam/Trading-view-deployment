// Simple service to fetch market data

// Fetch current price for a symbol
export const fetchCurrentPrice = async (symbol) => {
  try {
    const response = await fetch(`/api/prices/${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
};

// Fetch 24h data including open, high, low, close for a symbol
export const fetch24hData = async (symbol) => {
  try {
    const response = await fetch(`/api/prices/${symbol}/24h`);
    if (!response.ok) {
      throw new Error(`Failed to fetch 24h data for ${symbol}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching 24h data for ${symbol}:`, error);
    throw error;
  }
};

// Fetch market data for multiple symbols at once
export const fetchMarketData = async (symbols) => {
  try {
    // In a real implementation, you might have a batch endpoint
    // For now, we'll fetch each symbol individually
    const marketsData = await Promise.all(
      symbols.map(async (symbol) => {
        // For demonstration, we'll use random data
        // In production, you would fetch from your API
        const basePrice = getBasePrice(symbol);
        const previousClose = basePrice * (0.98 + Math.random() * 0.04);
        const currentPrice = basePrice * (0.98 + Math.random() * 0.04);
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        return {
          symbol,
          price: currentPrice,
          change,
          changePercent,
          previousClose
        };
      })
    );
    
    return marketsData;
  } catch (error) {
    console.error("Error fetching market data:", error);
    throw error;
  }
};

// Helper function to get base prices for symbols (for demonstration)
const getBasePrice = (symbol) => {
  const basePrices = {
    'BTCUSDT': 50000,
    'ETHUSDT': 3000,
    'SOLUSDT': 100,
    'BNBUSDT': 400,
    'DOGEUSDT': 0.1
  };
  
  return basePrices[symbol] || 100;
};
