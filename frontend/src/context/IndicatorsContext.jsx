import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const IndicatorsContext = createContext();

// Custom hook
export const useIndicators = () => {
  const context = useContext(IndicatorsContext);
  if (!context) {
    throw new Error('useIndicators must be used within an IndicatorsProvider');
  }
  return context;
};

// Provider component
export function IndicatorsProvider({ children }) {
  // Load saved indicators from localStorage on initial mount
  const [activeIndicators, setActiveIndicators] = useState(() => {
    try {
      const savedIndicators = localStorage.getItem('chartIndicators');
      return savedIndicators ? JSON.parse(savedIndicators) : [];
    } catch (error) {
      console.error('Error loading saved indicators:', error);
      return [];
    }
  });

  // Save indicators to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chartIndicators', JSON.stringify(activeIndicators));
    } catch (error) {
      console.error('Error saving indicators to localStorage:', error);
    }
  }, [activeIndicators]);

  // Add indicator
  const addIndicator = (indicator) => {
    // Create a unique instance ID for this indicator
    const instanceId = `${indicator.id}-${Date.now()}`;
    
    // Add to active indicators
    const newIndicator = {
      ...indicator,
      instanceId
    };
    
    setActiveIndicators(prev => [...prev, newIndicator]);
    return newIndicator;
  };
  
  // Remove indicator
  const removeIndicator = (instanceId) => {
    setActiveIndicators(prev => prev.filter(ind => ind.instanceId !== instanceId));
  };
  
  // Update indicator
  const updateIndicator = (updatedIndicator) => {
    setActiveIndicators(prev => 
      prev.map(ind => 
        ind.instanceId === updatedIndicator.instanceId ? updatedIndicator : ind
      )
    );
    return updatedIndicator;
  };

  const value = {
    activeIndicators,
    addIndicator,
    removeIndicator,
    updateIndicator
  };

  return (
    <IndicatorsContext.Provider value={value}>
      {children}
    </IndicatorsContext.Provider>
  );
}
