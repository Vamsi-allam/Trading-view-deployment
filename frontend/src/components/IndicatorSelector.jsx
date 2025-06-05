import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem'; // Add this import for select options
import { useTheme } from '../context/ThemeContext';
import { FaTimes, FaSearch } from 'react-icons/fa';
import './IndicatorSelector.css';

// Indicator categories and definitions
const INDICATOR_CATEGORIES = {
  trend: "Trend",
};

// Simplified INDICATORS with only EMA
const INDICATORS = {
  trend: [
    { id: 'ema', name: 'Exponential Moving Average', params: { period: 20, source: { type: 'select', value: 'close', options: ['close', 'open', 'high', 'low'] } } },
  ],
};

function IndicatorSelector({ open, onClose, onAddIndicator }) {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('trend');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [indicatorParams, setIndicatorParams] = useState({});
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSelectedIndicator(null);
  };
  
  // Handle indicator selection - simplify parameter handling
  const handleSelectIndicator = (indicator) => {
    setSelectedIndicator(indicator);
    
    // Create a clean params object with just the values
    const processedParams = {};
    Object.entries(indicator.params).forEach(([key, value]) => {
      if (typeof value === 'object' && value.type === 'select') {
        // For select type params, extract just the value
        processedParams[key] = value.value;
      } else {
        // For regular params, use as-is
        processedParams[key] = value;
      }
    });
    
    setIndicatorParams(processedParams);
  };
  
  // Handle parameter changes
  const handleParamChange = (paramKey, value) => {
    // Convert numeric strings to numbers
    const processedValue = 
      typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
    
    setIndicatorParams(prev => ({
      ...prev,
      [paramKey]: processedValue
    }));
  };
  
  // Handle adding the indicator to the chart
  const handleAddIndicator = () => {
    if (selectedIndicator) {
      // Create a clean copy of the indicator with properly formatted params
      const indicatorToAdd = {
        ...selectedIndicator,
        params: indicatorParams
      };
      
      onAddIndicator(indicatorToAdd);
      
      // Reset selection state
      setSelectedIndicator(null);
      setIndicatorParams({});
      onClose();
    }
  };
  
  // Filter indicators based on search query
  const filteredIndicators = searchQuery 
    ? Object.values(INDICATORS).flat().filter(ind => 
        ind.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : INDICATORS[activeTab];
  
  // Update the parameter rendering logic to handle different types
  const renderParamField = (key, value) => {
    const param = selectedIndicator.params[key];
    
    // Check if it's a select parameter
    if (typeof param === 'object' && param.type === 'select') {
      return (
        <div key={key} className="param-field">
          <TextField
            select
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            value={value}
            onChange={(e) => handleParamChange(key, e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
          >
            {param.options.map(option => (
              <MenuItem key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </MenuItem>
            ))}
          </TextField>
        </div>
      );
    }
    
    // Default to number input
    return (
      <div key={key} className="param-field">
        <TextField
          label={key.charAt(0).toUpperCase() + key.slice(1)}
          type="number"
          value={value}
          onChange={(e) => handleParamChange(key, Number(e.target.value))}
          fullWidth
          margin="normal"
          variant="outlined"
        />
      </div>
    );
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className={`indicator-selector ${isDarkMode ? 'dark' : 'light'}`}
      // Add these properties to fix the focus management issue
      disableRestoreFocus
      disableEnforceFocus
      keepMounted={false}
      // Make the aria attributes properly managed
      aria-labelledby="indicator-dialog-title"
    >
      <DialogTitle 
        className="indicator-dialog-title"
        id="indicator-dialog-title" // Add this id to connect with aria-labelledby
      >
        <span>Add Indicator</span>
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </DialogTitle>
      
      <div className="search-container">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search indicators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      <DialogContent className="indicator-dialog-content">
        {!selectedIndicator ? (
          // Indicator selection view
          <>
            {!searchQuery && (
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                className="indicator-tabs"
              >
                {Object.entries(INDICATOR_CATEGORIES).map(([key, label]) => (
                  <Tab key={key} value={key} label={label} />
                ))}
              </Tabs>
            )}
            
            <div className="indicators-grid">
              {filteredIndicators.map(indicator => (
                <div
                  key={indicator.id}
                  className="indicator-item"
                  onClick={() => handleSelectIndicator(indicator)}
                >
                  <span className="indicator-name">{indicator.name}</span>
                </div>
              ))}
              
              {filteredIndicators.length === 0 && (
                <div className="no-results">
                  No indicators match your search.
                </div>
              )}
            </div>
          </>
        ) : (
          // Indicator configuration view
          <div className="indicator-config">
            <h3>{selectedIndicator.name} Settings</h3>
            
            <div className="params-form">
              {Object.entries(indicatorParams).map(([key, value]) => 
                renderParamField(key, value)
              )}
            </div>
          </div>
        )}
      </DialogContent>
      
      <DialogActions className="indicator-dialog-actions">
        <Button onClick={onClose} className="cancel-button">
          Cancel
        </Button>
        
        {selectedIndicator && (
          <Button 
            onClick={handleAddIndicator} 
            color="primary" 
            variant="contained"
            className="add-button"
          >
            Add to Chart
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default IndicatorSelector;
