import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSnackbar } from './SnackbarContext';

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
  // Initialize alerts from localStorage or empty array
  const [alerts, setAlerts] = useState(() => {
    const savedAlerts = localStorage.getItem('tradingAlerts');
    return savedAlerts ? JSON.parse(savedAlerts) : [];
  });
  
  // Initialize triggered alerts from localStorage or empty object
  const [triggeredAlerts, setTriggeredAlerts] = useState(() => {
    const savedTriggeredAlerts = localStorage.getItem('tradingTriggeredAlerts');
    return savedTriggeredAlerts ? JSON.parse(savedTriggeredAlerts) : {};
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showWarning, showError } = useSnackbar?.() || {};
  
  // Store the last checked prices for each alert
  const lastCheckedPricesRef = useRef({});
  
  // Track the latest prices for all monitored symbols
  const latestPricesRef = useRef({});
  
  // Add a flag to prevent checking alerts during initial load
  const initialLoadRef = useRef(true);
  
  // Save alerts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('tradingAlerts', JSON.stringify(alerts));
  }, [alerts]);

  // Save triggered alerts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('tradingTriggeredAlerts', JSON.stringify(triggeredAlerts));
  }, [triggeredAlerts]);
  
  // Load alerts on mount - use local storage as the source of truth
  useEffect(() => {
    const loadAlerts = () => {
      try {
        setLoading(true);
        // No API call, just use state already loaded from localStorage
        initialLoadRef.current = false;
      } catch (error) {
        console.error('Error loading alerts:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadAlerts();
    
    // Reset initial load flag when component unmounts
    return () => {
      initialLoadRef.current = true;
    };
  }, []);
  
  // Handle alert triggering with better error handling and cooldown management
  const handleAlertTriggered = useCallback(async (alert, price) => {
    try {
      // Mark the alert as triggered in state
      setTriggeredAlerts(prev => ({
        ...prev,
        [alert.id]: true
      }));
      
      // Show notification
      if (alert.condition === 'above') {
        showSuccess(`${alert.symbol} has risen above ${alert.value}`);
      } else if (alert.condition === 'below') {
        showWarning(`${alert.symbol} has fallen below ${alert.value}`);
      } else {
        showSuccess(`${alert.symbol} alert triggered: ${alert.condition} ${alert.value}`);
      }
      
      // No need for API call for triggered alerts - this is all local now
      
    } catch (error) {
      console.error('Error handling triggered alert:', error);
      showError(`Failed to process alert: ${error.message}`);
    }
  }, [showSuccess, showWarning, showError]);
  
  // Function to check alerts for a specific symbol
  const checkAlertsForSymbol = useCallback((symbol, price) => {
    // Store the latest price
    latestPricesRef.current[symbol] = price;
    
    // Find alerts for this symbol
    const symbolAlerts = alerts.filter(
      alert => alert.symbol === symbol && (!triggeredAlerts[alert.id])
    );
    
    symbolAlerts.forEach(alert => {
      const targetValue = parseFloat(alert.value);
      const lastPrice = lastCheckedPricesRef.current[symbol] || price;
      
      // Skip if no valid target value
      if (isNaN(targetValue)) return;
      
      // Check conditions
      if (alert.condition === 'above' && price >= targetValue && lastPrice < targetValue) {
        handleAlertTriggered(alert, price);
      } 
      else if (alert.condition === 'below' && price <= targetValue && lastPrice > targetValue) {
        handleAlertTriggered(alert, price);
      }
      else if (alert.condition === 'crosses') {
        if ((lastPrice < targetValue && price >= targetValue) || 
            (lastPrice > targetValue && price <= targetValue)) {
          handleAlertTriggered(alert, price);
        }
      }
    });
    
    // Update the last checked price
    lastCheckedPricesRef.current[symbol] = price;
  }, [alerts, triggeredAlerts, handleAlertTriggered]);
  
  // Replace the existing checkAlertsAgainstPrice function with this improved version
  const checkAlertsAgainstPrice = useCallback((symbol, price) => {
    // Skip if we're still in initial load
    if (initialLoadRef.current) return;
    
    checkAlertsForSymbol(symbol, price);
  }, [checkAlertsForSymbol]);
  
  // Function to create an alert without refreshing the chart
  const createAlertWithoutRefresh = useCallback(async (alertData) => {
    try {
      // Create local alert with generated ID
      const localAlert = {
        ...alertData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      // Update alerts state
      setAlerts(prev => [...prev, localAlert]);
      return localAlert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }, []);
  
  // Add function to update an alert without refreshing the chart
  const updateAlertWithoutRefresh = useCallback(async (alertId, alertData) => {
    try {
      // Update the local alert
      const updatedAlert = {
        ...alertData,
        id: alertId,
        status: 'active'
      };
      
      // Update in state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, ...updatedAlert } : alert
      ));
      
      return updatedAlert;
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  }, []);
  
  // Function to delete an alert locally
  const deleteAlertLocal = useCallback((alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    
    // Also remove from triggered alerts if it exists
    if (triggeredAlerts[alertId]) {
      const newTriggeredAlerts = { ...triggeredAlerts };
      delete newTriggeredAlerts[alertId];
      setTriggeredAlerts(newTriggeredAlerts);
    }
  }, [triggeredAlerts]);
  
  // Function to manually reset a triggered alert (for UI button)
  const resetTriggeredAlert = useCallback((alertId) => {
    if (triggeredAlerts[alertId]) {
      const newTriggeredAlerts = { ...triggeredAlerts };
      delete newTriggeredAlerts[alertId];
      setTriggeredAlerts(newTriggeredAlerts);
    }
  }, [triggeredAlerts]);
  
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
    updateAlertWithoutRefresh,
    deleteAlertLocal
  }
  
  return (
    <AlertsContext.Provider value={value}>
      {children}
    </AlertsContext.Provider>
  )
}
