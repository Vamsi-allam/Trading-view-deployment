import { useState } from 'react';
import { FaTimes, FaCog } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import './IndicatorManager.css';

function IndicatorManager({ activeIndicators, onRemoveIndicator, onUpdateIndicator }) {
  const { isDarkMode } = useTheme();
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [expandedPanel, setExpandedPanel] = useState(false);
  
  const togglePanel = () => {
    setExpandedPanel(!expandedPanel);
    setEditingIndicator(null);
  };
  
  const handleEditIndicator = (indicator) => {
    setEditingIndicator(indicator);
    setExpandedPanel(true);
  };
  
  const handleUpdateIndicator = () => {
    if (editingIndicator) {
      onUpdateIndicator(editingIndicator);
      setEditingIndicator(null);
    }
  };
  
  const handleParamChange = (paramKey, value) => {
    if (editingIndicator) {
      // Check if the original parameter is a select type
      const originalParam = editingIndicator.params[paramKey];
      
      // Process the value based on parameter type
      let processedValue = value;
      if (typeof value === 'string' && !isNaN(Number(value))) {
        processedValue = Number(value);
      }
      
      setEditingIndicator({
        ...editingIndicator,
        params: {
          ...editingIndicator.params,
          [paramKey]: processedValue
        }
      });
    }
  };
  
  // Update the parameter rendering in the edit view to handle different types
  const renderParamField = (key, value) => {
    // Handle special parameter types
    if (key === 'source') {
      // Source is always a select field with standard options
      return (
        <div key={key} className="param-field">
          <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
          <select
            value={value}
            onChange={(e) => handleParamChange(key, e.target.value)}
            className="param-select"
          >
            {['close', 'open', 'high', 'low'].map(option => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    // Default to number input for most parameters
    return (
      <div key={key} className="param-field">
        <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
        <input
          type="number"
          value={value}
          onChange={(e) => handleParamChange(key, e.target.value)}
        />
      </div>
    );
  };
  
  return (
    <div className={`indicator-manager ${isDarkMode ? 'dark' : 'light'} ${expandedPanel ? 'expanded' : ''}`}>
      <div className="indicator-manager-header" onClick={togglePanel}>
        <span>Indicators ({activeIndicators.length})</span>
        <span className="indicator-expand-icon">{expandedPanel ? '▲' : '▼'}</span>
      </div>
      
      {expandedPanel && (
        <div className="indicator-manager-content">
          {!editingIndicator ? (
            // List of active indicators
            <div className="active-indicators-list">
              {activeIndicators.map((indicator) => (
                <div key={indicator.id + indicator.instanceId} className="active-indicator-item">
                  <span className="indicator-name">{indicator.name}</span>
                  <div className="indicator-actions">
                    <button 
                      className="indicator-action-btn"
                      onClick={() => handleEditIndicator(indicator)}
                      title="Edit indicator"
                    >
                      <FaCog />
                    </button>
                    <button 
                      className="indicator-action-btn remove"
                      onClick={() => onRemoveIndicator(indicator.instanceId)}
                      title="Remove indicator"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              ))}
              
              {activeIndicators.length === 0 && (
                <div className="no-indicators">
                  No indicators added to chart.
                </div>
              )}
            </div>
          ) : (
            // Editing indicator view
            <div className="edit-indicator">
              <h4>{editingIndicator.name} Settings</h4>
              
              <div className="params-form">
                {Object.entries(editingIndicator.params).map(([key, value]) => 
                  renderParamField(key, value)
                )}
              </div>
              
              <div className="edit-actions">
                <button 
                  className="btn-outline" 
                  onClick={() => setEditingIndicator(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleUpdateIndicator}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IndicatorManager;
