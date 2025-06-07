const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Generate mock candle data since we don't have a backend yet
function generateMockCandles(symbol, timeframe) {
  const candles = [];
  const now = Math.floor(Date.now() / 1000);
  
  // Define price ranges based on symbol
  let basePrice = 0;
  let volatility = 0;
  
  if (symbol === 'BTCUSDT') {
    basePrice = 50000;
    volatility = 1000;
  } else if (symbol === 'ETHUSDT') {
    basePrice = 3000;
    volatility = 100;
  } else if (symbol === 'SOLUSDT') {
    basePrice = 100;
    volatility = 5;
  } else if (symbol === 'DOGEUSDT') {
    basePrice = 0.18; // Updated from 0.07 to current price range
    volatility = 0.01; // Increased for more realistic volatility
  }
  
  // Time interval in seconds
  let interval = 60; // 1m
  if (timeframe === '5m') interval = 300;
  if (timeframe === '15m') interval = 900;
  if (timeframe === '1h') interval = 3600;
  if (timeframe === '4h') interval = 14400;
  if (timeframe === '1d') interval = 86400;
  
  // Generate candles
  for (let i = 0; i < 100; i++) {
    const time = now - (100 - i) * interval;
    const open = basePrice + (Math.random() - 0.5) * volatility;
    const high = open + Math.random() * volatility * 0.2;
    const low = open - Math.random() * volatility * 0.2;
    const close = open + (Math.random() - 0.5) * volatility * 0.5;
    
    candles.push({
      time: time, // Ensure this is in seconds, not milliseconds
      open: open,
      high: high,
      low: low,
      close: close,
      volume: Math.random() * 100
    });
  }
  
  return candles;
}

export async function fetchCandles(symbol, timeframe) {
  try {
    // Convert timeframe to Binance format
    const interval = timeframe; // Already in correct format: 1m, 5m, 15m, 1h, 4h, 1d
    
    // Target total candles to fetch
    const targetCandles = 5000;
    const maxPerRequest = 1000; // Binance API limit per request
    const maxRequests = Math.ceil(targetCandles / maxPerRequest);
    
    let allCandles = [];
    let endTime = null;
    
    // Make multiple requests to get up to 5000 candles
    for (let i = 0; i < maxRequests; i++) {
      // Build URL with parameters
      let url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${maxPerRequest}`;
      if (endTime) {
        url += `&endTime=${endTime}`;
      }
      
      console.log(`Fetching candles batch ${i+1}/${maxRequests} from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Break if no more candles
      if (data.length === 0) break;
      
      // Format the data
      const formattedBatch = data.map(candle => ({
        time: candle[0] / 1000, // Convert from ms to seconds
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
      
      // Add to our collection (in the correct order)
      allCandles = [...formattedBatch, ...allCandles]; // Prepend as we're going backward in time
      
      // If we got fewer than requested, we've reached the limit
      if (data.length < maxPerRequest) break;
      
      // Set the end time for the next request to be 1ms before the oldest candle
      endTime = data[0][0] - 1;
      
      // If we've collected enough candles, stop
      if (allCandles.length >= targetCandles) break;
    }
    
    // Trim to target limit if needed
    const finalCandles = allCandles.length > targetCandles 
      ? allCandles.slice(-targetCandles) 
      : allCandles;
    
    console.log(`Fetched total of ${finalCandles.length} candles for ${symbol} @ ${timeframe}`);
    return finalCandles;
  } catch (error) {
    console.error('Error fetching candles from Binance:', error);
    
    // Fallback to mock data if Binance API fails
    console.log('Falling back to mock data');
    const mockData = generateMockCandles(symbol, timeframe);
    return mockData;
  }
}

// Mock alerts array
const mockAlerts = [];

export async function fetchAlerts() {
  try {
    // Try to fetch from backend if it's running
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`);
      if (response.ok) {
        return await response.json();
      }
    } catch (backendError) {
      console.log('Backend not available, using mock data for alerts');
    }
    
    // Return mock data as fallback
    return [...mockAlerts];
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
}

// Add diagnostic functions to check alert triggering
export const triggerAlertTest = async (symbol, condition, value) => {
  try {
    console.log("🔍 DIAGNOSTIC: Manual alert trigger test started");
    
    // Step 1: Get current price
    const priceResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/prices/${symbol}`);
    if (!priceResponse.ok) {
      throw new Error(`Failed to get current price: ${priceResponse.statusText}`);
    }
    const priceData = await priceResponse.json();
    const currentPrice = priceData.price;
    console.log(`🔍 DIAGNOSTIC: Got current price for ${symbol}: ${currentPrice}`);
    
    // Step 2: Check if condition would be met
    let conditionMet = false;
    const numValue = parseFloat(value);
    if (condition === 'above') {
      conditionMet = currentPrice > numValue;
    } else if (condition === 'below') {
      conditionMet = currentPrice < numValue;
    } else if (condition === 'crosses') {
      // Can't determine for crosses without history
      conditionMet = Math.abs(currentPrice - numValue) / numValue < 0.01; // Within 1%
    }
    
    console.log(`🔍 DIAGNOSTIC: Condition check - ${condition} ${value}: ${conditionMet ? 'MET' : 'NOT MET'}`);
    
    // Step 3: Test Discord webhook directly
    console.log("⚠️ TESTING DISCORD WEBHOOK DIRECTLY ⚠️");
    const webhookTestResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/discord/test-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Test message from trading app diagnostic: ${symbol} ${condition} ${value}`
      }),
    });
    
    const webhookTestResult = await webhookTestResponse.json();
    console.log(`⚠️ Discord test response status: ${webhookTestResponse.status}`);
    console.log(`⚠️ Discord test response:`, webhookTestResult);
    
    const webhookTest = {
      success: webhookTestResponse.ok,
      status: webhookTestResponse.status,
      data: webhookTestResult
    };
    
    console.log("🔍 DIAGNOSTIC: Discord webhook test result:", webhookTest);
    
    // Step 4: Try to force trigger the alert
    const alertResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/alerts/force-trigger-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        condition,
        value,
        price: currentPrice
      }),
    });
    
    const alertResult = alertResponse.ok ? 
      await alertResponse.json() : 
      { detail: alertResponse.statusText };
    
    console.log("🔍 DIAGNOSTIC: Manual trigger result:", alertResult);
    
    return {
      success: webhookTest.success,
      price: currentPrice,
      conditionMet,
      webhookTest,
      alertResult
    };
  } catch (error) {
    console.error("🔍 DIAGNOSTIC ERROR:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add a new function to directly test Discord connectivity
export async function testDiscordWebhook() {
  try {
    console.log('⚠️ TESTING DISCORD WEBHOOK DIRECTLY ⚠️');
    
    const response = await fetch(`${API_BASE_URL}/verify-discord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testMessage: "This is a direct webhook test from the frontend",
        timestamp: new Date().toISOString()
      }),
    });
    
    console.log(`⚠️ Discord test response status: ${response.status}`);
    const responseData = await response.json().catch(() => ({}));
    console.log('⚠️ Discord test response:', responseData);
    
    return {
      success: response.ok,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    console.error('⚠️ Discord test error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Completely rewritten sendDiscordAlert function with multiple fallbacks
export async function sendDiscordAlert(alert, currentPrice) {
  try {
    console.log(`🚨🚨🚨 SENDING DISCORD ALERT: ${alert.symbol} ${alert.condition} ${alert.value} at price ${currentPrice}`);
    
    // Simplify the approach - send directly to test-alert endpoint
    const response = await fetch(`${API_BASE_URL}/test-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: alert.symbol,
        price: currentPrice,
        condition: alert.condition,
        targetPrice: parseFloat(alert.value),
        isRealAlert: true,
        forceSend: true,  // Force send the alert
        message: `🚨@everyone ALERT TRIGGERED: ${alert.symbol} has ${
          alert.condition === 'above' ? 'risen above' : 
          alert.condition === 'below' ? 'fallen below' : 
          'crossed'
        } ${alert.value} (current price: ${currentPrice})`
      }),
    });
    
    const responseData = await response.json().catch(() => ({}));
    console.log('🚨 Discord alert response:', responseData);
    
    if (response.ok) {
      return { 
        success: true, 
        message: "Alert sent to Discord",
        data: responseData
      };
    } else {
      // Try direct approach if the test-alert endpoint fails
      const directResponse = await fetch(`${API_BASE_URL}/discord/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🚨 DIRECT ALERT: ${alert.symbol} has ${
            alert.condition === 'above' ? 'risen above' : 
            alert.condition === 'below' ? 'fallen below' : 
            'crossed'
          } ${alert.value} (current price: ${currentPrice})`,
          embeds: [{
            "title": `${alert.symbol} Alert Triggered`,
            "description": `Alert condition was met`,
            "color": 16711680, // Red
            "fields": [
              {
                "name": "Symbol",
                "value": alert.symbol,
                "inline": true
              },
              {
                "name": "Condition",
                "value": alert.condition,
                "inline": true
              },
              {
                "name": "Target Price",
                "value": alert.value,
                "inline": true
              },
              {
                "name": "Current Price",
                "value": String(currentPrice),
                "inline": true
              },
              {
                "name": "Time",
                "value": new Date().toLocaleString(),
                "inline": false
              }
            ]
          }]
        }),
      });
      
      // Check if direct approach worked
      if (directResponse.ok) {
        const directData = await directResponse.json().catch(() => ({}));
        return { 
          success: true, 
          message: "Alert sent to Discord via direct method",
          data: directData
        };
      }
      
      return { 
        success: false, 
        message: "Failed to send Discord alert",
        error: responseData.message || "Unknown error"
      };
    }
  } catch (error) {
    console.error('🚨 Error sending Discord alert:', error);
    return { 
      success: false, 
      message: "Error sending Discord alert",
      error: error.message
    };
  }
}

// Update createAlert to ensure it doesn't trigger test alerts automatically
export async function createAlert(alertData) {
  try {
    // Extract the skipTestNotification flag and remove it from the data sent to backend
    const { skipTestNotification = true, ...dataToSend } = alertData;
    
    // Try to send to backend if it's running
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend), // Send without the skip flag
      });
      
      if (response.ok) {
        const createdAlert = await response.json();
        // Don't send a test notification even if successful
        return createdAlert;
      }
    } catch (backendError) {
      console.log('Backend not available, using mock data for creating alert');
    }
    
    // Create mock alert as fallback - but don't send any notifications
    const newAlert = {
      ...dataToSend, // Use the cleaned data without the skip flag
      id: String(Date.now()),
      created_at: new Date().toISOString(),
      status: 'active'
    };
    mockAlerts.push(newAlert);
    
    return newAlert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
}

export async function deleteAlert(alertId) {
  try {
    // Try to delete from backend if it's running
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        return true;
      }
    } catch (backendError) {
      console.log('Backend not available, using mock data for deleting alert');
    }
    
    // Delete from mock data as fallback
    const index = mockAlerts.findIndex(a => a.id === alertId);
    if (index !== -1) {
      mockAlerts.splice(index, 1);
    }
    return true;
  } catch (error) {
    console.error('Error deleting alert:', error);
    throw error;
  }
}

export async function sendTestAlert(symbol = 'BTCUSDT') {
  try {
    // Try to send test alert to backend if it's running
    try {
      console.log('Sending test alert request for symbol:', symbol);
      const response = await fetch(`${API_BASE_URL}/test-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          symbol,
          price: symbol === 'BTCUSDT' ? 50000 : 
                 symbol === 'ETHUSDT' ? 3000 : 
                 symbol === 'DOGEUSDT' ? 0.18 : 100 // Updated DOGE price
        }),
      });
      
      // Parse the response JSON even for error cases
      const responseData = await response.json();
      console.log('Test alert response:', responseData);
      
      if (response.ok) {
        return responseData;
      } else {
        // Get the error message from the response if available
        const errorMsg = responseData.message || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }
    } catch (backendError) {
      console.error('Backend error:', backendError);
      
      // More specific error message
      if (backendError.message.includes('Failed to fetch')) {
        throw new Error('Backend not available. Please start the backend server to test Discord alerts.');
      }
      
      // Re-throw the original error
      throw backendError;
    }
  } catch (error) {
    console.error('Error sending test alert:', error);
    throw error;
  }
}

// Track active subscriptions to prevent duplicates
const activeSubscriptions = {};

// Real-time price updates with better subscription management
export function subscribeToPriceUpdates(symbol, callback) {
  // Clean up any existing subscription for this symbol
  if (activeSubscriptions[symbol]) {
    //console.log(`Cleaning up existing subscription for ${symbol}`);
    activeSubscriptions[symbol]();
    delete activeSubscriptions[symbol];
  }
  
  let timerId = null;
  const subscriptionSymbol = symbol; // Capture the symbol for this specific subscription
  
  // Function to fetch the current price
  const fetchLatestPrice = async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${subscriptionSymbol.toUpperCase()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data.price) {
        const price = parseFloat(data.price);
        const timestamp = Math.floor(Date.now() / 1000);
        
        if (!isNaN(price) && price > 0) {
          try {
            callback(price, timestamp, subscriptionSymbol);
          } catch (callbackError) {
            console.error(`Error in price update callback for ${subscriptionSymbol}:`, callbackError);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching latest price for ${subscriptionSymbol}:`, error);
    }
  };
  
  // Fetch immediately
  fetchLatestPrice();
  
  // Set up interval for regular updates
  timerId = setInterval(fetchLatestPrice, 3000);
  
  // Create unsubscribe function
  const unsubscribe = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };
  
  // Store in active subscriptions
  activeSubscriptions[subscriptionSymbol] = unsubscribe;
  
  return unsubscribe;
}

// Rewrite the alert trigger checking function for better accuracy
export function checkAlertTrigger(alert, currentPrice) {
  if (!alert || !currentPrice) {
    console.log('⚠️ Invalid alert or price data');
    return false;
  }
  
  const price = parseFloat(currentPrice);
  const alertValue = parseFloat(alert.value);
  
  if (isNaN(price) || isNaN(alertValue)) {
    console.log('⚠️ Invalid number values', { price, alertValue });
    return false;
  }
  
  // Determine if the condition is met based on the alert type
  let conditionMet = false;
  
  switch (alert.condition) {
    case 'above':
      conditionMet = price >= alertValue;
      console.log(`⚠️ Above check: ${price} >= ${alertValue} = ${conditionMet}`);
      break;
    case 'below':
      conditionMet = price <= alertValue;
      console.log(`⚠️ Below check: ${price} <= ${alertValue} = ${conditionMet}`);
      break;
    case 'crosses':
      // For "crosses", we can only determine this with previous price knowledge
      // This will just return if we're close to the threshold
      const diff = Math.abs(price - alertValue);
      const threshold = Math.max(0.001 * alertValue, 0.5); // 0.1% or 0.5 units
      conditionMet = diff < threshold;
      console.log(`⚠️ Crosses check: diff=${diff}, threshold=${threshold}, result=${conditionMet}`);
      break;
    default:
      console.log(`⚠️ Unknown condition: ${alert.condition}`);
  }
  
  return conditionMet;
}

// Update the updateAlert function to handle servers that don't support PUT
export async function updateAlert(alertId, alertData) {
  try {
    // First try using PUT
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // If PUT fails with Method Not Allowed, try using POST with special parameter
      if (response.status === 405) {
        console.log('PUT method not allowed, trying alternative approach');
        
        // Try POST with update flag
        const postResponse = await fetch(`${API_BASE_URL}/alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...alertData,
            id: alertId,  // Include the ID to indicate this is an update
            isUpdate: true
          }),
        });
        
        if (postResponse.ok) {
          return await postResponse.json();
        }
      }
    } catch (backendError) {
      console.log('Backend not available or error during update:', backendError);
    }
    
    // Update mock alert as fallback
    const index = mockAlerts.findIndex(a => a.id === alertId);
    if (index !== -1) {
      const updatedAlert = {
        ...mockAlerts[index],
        ...alertData,
        id: alertId, // Ensure ID doesn't change
        created_at: mockAlerts[index].created_at // Keep original creation time
      };
      mockAlerts[index] = updatedAlert;
      return updatedAlert;
    } else {
      throw new Error('Alert not found');
    }
  } catch (error) {
    console.error('Error updating alert:', error);
    throw error;
  }
}

// Add fetch functions for market data
export const fetchCurrentPrice = async (symbol) => {
  try {
    // Check if API is down/unreachable by trying a simple fetch
    const testResponse = await fetch('/api/health', { 
      method: 'HEAD',
      timeout: 1000 // Add a short timeout to fail fast
    });
    
    // If health check fails, throw error to use fallback data
    if (!testResponse.ok) {
      throw new Error('API health check failed');
    }
    
    // Try to fetch the real price
    const response = await fetch(`/api/prices/${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
    
    // Try to parse the response as JSON
    try {
      const data = await response.json();
      return data.price;
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error('Invalid JSON response');
    }
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    
    // Return fallback price instead of throwing
    const fallbackPrice = FALLBACK_PRICES[symbol] || 100;
    return fallbackPrice * (0.995 + Math.random() * 0.01); // Add small variation
  }
};

export const fetchMarketData = async (symbols) => {
  try {
    const marketData = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Use import.meta.env instead of process.env
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          const response = await fetch(`${API_URL}/prices/${symbol}`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          return {
            symbol,
            price: data.price || 0,
            change: data.change || 0,
            changePercent: data.changePercent || 0,
            previousClose: data.previousClose || 0
          };
        } catch (error) {
          console.error(`Error fetching data for ${symbol}`, error);
          // Return placeholder data in case of error
          return {
            symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            previousClose: 0,
            error: true
          };
        }
      })
    );
    
    return marketData;
  } catch (error) {
    console.error("Error fetching market data:", error);
    throw error;
  }
};
