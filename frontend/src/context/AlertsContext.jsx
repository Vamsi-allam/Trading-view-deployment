import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { fetchAlerts, checkAlertTrigger, sendDiscordAlert, createAlert, updateAlert } from '../services/api'
import { useSnackbar } from '../context/SnackbarContext'

// Create context
const AlertsContext = createContext()

// Fix the hook export to be compatible with Fast Refresh
// Custom hook for using the alerts context - make it a const function
export const useAlerts = () => {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider')
  }
  return context
}

// Provider component - keep as named export function
export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { showSuccess, showWarning, showError } = useSnackbar?.() || {}
  
  // Store the last checked prices for each alert
  const lastCheckedPricesRef = useRef({});
  
  // Track temporarily triggered alerts with cooldown
  const [triggeredAlerts, setTriggeredAlerts] = useState({});
  
  // Add a ref to track when alerts were triggered
  const triggeredTimeRef = useRef({});
  
  // Track price subscriptions for all symbols with active alerts
  const priceSubscriptionsRef = useRef({});
  
  // Track the latest prices for all monitored symbols
  const latestPricesRef = useRef({});
  
  // Add a flag to prevent checking alerts during initial load
  const initialLoadRef = useRef(true);
  
  // Load alerts on mount
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true)
        const data = await fetchAlerts()
        setAlerts(data)
        setError(null)
      } catch (err) {
        console.error('Error loading alerts:', err)
        setError('Failed to load alerts')
      } finally {
        setLoading(false)
        
        // Mark initial load as complete after a short delay
        // This ensures we don't trigger alerts on first load
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 5000); // Wait 5 seconds before enabling alert checking
      }
    }
    
    loadAlerts()
    
    // Reset initial load flag when component unmounts
    return () => {
      initialLoadRef.current = true;
    }
  }, [])
  
  // Set up price tracking for all symbols with active alerts
  useEffect(() => {
    // Skip if we're still loading alerts
    if (loading || alerts.length === 0) return;
    
    // Get unique symbols from active alerts
    const symbolsToMonitor = [...new Set(
      alerts
        .filter(alert => alert.status === 'active')
        .map(alert => alert.symbol)
    )];
    
    console.log('Setting up price tracking for symbols:', symbolsToMonitor);
    
    // Import the subscribeToPriceUpdates function
    import('../services/api').then(({ subscribeToPriceUpdates }) => {
      // Clean up any existing subscriptions
      Object.values(priceSubscriptionsRef.current).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      
      // Create a new subscriptions object
      const newSubscriptions = {};
      
      // Subscribe to price updates for each symbol
      symbolsToMonitor.forEach(symbol => {
        newSubscriptions[symbol] = subscribeToPriceUpdates(symbol, (price) => {
          // Store the latest price for this symbol
          latestPricesRef.current[symbol] = price;
          
          // Check alerts for this symbol when price updates
          if (!initialLoadRef.current) {
            checkAlertsForSymbol(symbol, price);
          }
        });
      });
      
      // Update the subscriptions ref
      priceSubscriptionsRef.current = newSubscriptions;
    });
    
    // Clean up subscriptions on unmount
    return () => {
      Object.values(priceSubscriptionsRef.current).forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      priceSubscriptionsRef.current = {};
    };
  }, [alerts, loading]);
  
  // Handle alert triggering with better error handling and cooldown management
  const handleAlertTriggered = useCallback(async (alert, price) => {
    console.log(`⚠️⚠️⚠️ ALERT TRIGGERED! ${alert.symbol} ${alert.condition} ${alert.value} (current: ${price})`);
    
    try {
      // Store the trigger time
      triggeredTimeRef.current[alert.id] = Date.now();
      
      // Send Discord notification with better error handling
      const result = await sendDiscordAlert(alert, price);
      
      if (result.success) {
        showSuccess?.(`Alert triggered: ${alert.symbol} ${alert.condition} ${alert.value}`);
        console.log(`⚠️ Discord alert success:`, result);
      } else {
        showWarning?.(`Alert triggered but Discord notification failed: ${result.message}`);
        console.error(`⚠️ Discord alert failed:`, result);
      }
      
      // Mark as triggered in local state (for UI display)
      setTriggeredAlerts(prev => ({
        ...prev,
        [alert.id]: true
      }));
      
      // Important: DON'T change the alert status to 'triggered' permanently
      // Instead, we'll mark it as triggered temporarily for the cooldown period
      
      // Reset the triggered state after cooldown period
      setTimeout(() => {
        console.log(`⚠️ Cooldown complete for alert ${alert.id}. Alert is now active again.`);
        
        // Remove from triggered alerts (but keep alert status as 'active')
        setTriggeredAlerts(prev => {
          const updated = {...prev};
          delete updated[alert.id];
          return updated;
        });
        
      }, 60000); // 1-minute cooldown before allowing to trigger again
      
      return true;
    } catch (error) {
      console.error('⚠️ Error handling triggered alert:', error);
      showError?.(`Error sending alert notification: ${error.message}`);
      return false;
    }
  }, [showSuccess, showWarning, showError]);
  
  // Function to check alerts for a specific symbol
  const checkAlertsForSymbol = useCallback((symbol, price) => {
    if (initialLoadRef.current) return [];
    
    // Get active alerts for this symbol - IMPORTANT: check for status='active' 
    const symbolAlerts = alerts.filter(alert => 
      alert.symbol === symbol && 
      alert.status === 'active'  // Only consider alerts that are active
    );
    
    if (symbolAlerts.length === 0) return [];
    
    // Skip extremely frequent logs to avoid console spam
    if (Math.random() < 0.1) { // Only log ~10% of checks
      console.log(`Checking ${symbolAlerts.length} alerts for ${symbol} at price ${price}`);
    }
    
    const newTriggeredAlerts = [];
    
    symbolAlerts.forEach(alert => {
      const alertId = alert.id;
      const lastPrice = lastCheckedPricesRef.current[alertId];
      const lastTriggeredTime = triggeredTimeRef.current[alertId] || 0;
      const currentTime = Date.now();
      const timeSinceLastTrigger = currentTime - lastTriggeredTime;
      const isInCooldown = timeSinceLastTrigger < 60000; // 1 minute cooldown
      const alertValue = parseFloat(alert.value);
      
      // If this is the first time we're checking this alert, store the price but don't trigger
      if (lastPrice === undefined) {
        console.log(`First check for alert ${alertId}, storing price ${price} without triggering`);
        lastCheckedPricesRef.current[alertId] = price;
        return; // Skip this alert for now
      }
      
      // Skip if the alert is currently in cooldown period (less than 1 minute since last trigger)
      if (isInCooldown) {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
          console.log(`Alert ${alertId} is in cooldown (${Math.round(timeSinceLastTrigger/1000)}s elapsed, needs 60s)`);
        }
        return; // Skip this alert during cooldown
      }
      
      // Determine if we should trigger based on price crossing the threshold
      let shouldTrigger = false;
      
      if (alert.condition === 'above' && lastPrice < alertValue && price >= alertValue) {
        console.log(`Alert triggered: ${alert.symbol} crossed above ${alertValue}`);
        shouldTrigger = true;
      } 
      else if (alert.condition === 'below' && lastPrice > alertValue && price <= alertValue) {
        console.log(`Alert triggered: ${alert.symbol} crossed below ${alertValue}`);
        shouldTrigger = true;
      }
      else if (alert.condition === 'crosses') {
        const crossedUp = lastPrice < alertValue && price >= alertValue;
        const crossedDown = lastPrice > alertValue && price <= alertValue;
        if (crossedUp || crossedDown) {
          console.log(`Alert triggered: ${alert.symbol} crossed ${alertValue}`);
          shouldTrigger = true;
        }
      }
      
      // Update the last checked price
      lastCheckedPricesRef.current[alertId] = price;
      
      // If we should trigger the alert
      if (shouldTrigger) {
        console.log(`ALERT TRIGGERED! ${alert.symbol} ${alert.condition} ${alert.value} at ${new Date().toLocaleTimeString()}`);
        newTriggeredAlerts.push(alert);
        
        // Record the trigger time immediately (even before the async operation)
        triggeredTimeRef.current[alertId] = currentTime;
        
        // Handle alert triggering (this will start the cooldown)
        handleAlertTriggered(alert, price);
      }
    });
    
    return newTriggeredAlerts;
  }, [alerts, handleAlertTriggered]);
  
  // Replace the existing checkAlertsAgainstPrice function with this improved version
  const checkAlertsAgainstPrice = useCallback((symbol, price) => {
    // This function is called from the chart component, but we'll now handle price
    // subscriptions independently, so just update the latest price
    latestPricesRef.current[symbol] = price;
    
    // For backward compatibility, also check alerts for this symbol
    return checkAlertsForSymbol(symbol, price);
  }, [checkAlertsForSymbol]);
  
  // Function to create an alert without refreshing the chart
  const createAlertWithoutRefresh = useCallback(async (alertData) => {
    try {
      const createdAlert = await createAlert({
        ...alertData,
        skipTestNotification: true
      });
      
      // Update local state in a way that doesn't trigger chart refresh
      setAlerts(prev => [...prev, createdAlert]);
      
      return createdAlert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }, []);
  
  // Add function to update an alert without refreshing the chart
  const updateAlertWithoutRefresh = useCallback(async (alertId, alertData) => {
    try {
      const updatedAlert = await updateAlert(alertId, {
        ...alertData,
        skipTestNotification: true
      });
      
      // Update local state in a way that doesn't trigger chart refresh
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? updatedAlert : alert
      ));
      
      return updatedAlert;
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  }, []);
  
  // Function to manually reset a triggered alert (for UI button)
  const resetTriggeredAlert = useCallback((alertId) => {
    // Remove from triggered alerts to make it active again immediately
    setTriggeredAlerts(prev => {
      const newState = { ...prev };
      delete newState[alertId];
      return newState;
    });
    
    // Clear the trigger time
    delete triggeredTimeRef.current[alertId];
    
    console.log(`Alert ${alertId} manually reset. It will trigger again on next condition match.`);
  }, []);
  
  // Context value - make sure to include all required functions and state
  const value = {
    alerts,
    setAlerts,
    loading,
    error,
    checkAlertsAgainstPrice,
    resetTriggeredAlert,
    triggeredAlerts,
    createAlertWithoutRefresh,
    updateAlertWithoutRefresh
  }
  
  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  )
}
