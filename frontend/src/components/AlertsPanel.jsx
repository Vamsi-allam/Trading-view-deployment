import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { FaTrash, FaBell, FaEdit } from 'react-icons/fa'
import { createAlert, deleteAlert, sendTestAlert, triggerAlertTest } from '../services/api'
import { useAlerts } from '../context/AlertsContext'
import { useSnackbar } from '../context/SnackbarContext';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import './AlertsPanel.css'

// Update function signature to accept compact prop with default value
const AlertsPanel = ({ compact = false }) => {
  const { alerts, setAlerts, resetTriggeredAlert, triggeredAlerts, createAlertWithoutRefresh, updateAlertWithoutRefresh } = useAlerts()
  const { isDarkMode } = useTheme()
  const [newAlert, setNewAlert] = useState({
    symbol: 'BTCUSDT',
    type: 'price',
    condition: 'above',
    value: '',
    notifyDiscord: true
  })
  const [isTestingAlert, setIsTestingAlert] = useState(false)
  const { showSuccess, showError, showInfo } = useSnackbar();
  const [confirmDialog, setConfirmDialog] = useState({ open: false, alertId: null });
  
  // Add state for edit mode
  const [editMode, setEditMode] = useState(false);
  const [editAlertId, setEditAlertId] = useState(null);
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setNewAlert({
      ...newAlert,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleCreateAlert = async () => {
    try {
      if (editMode && editAlertId) {
        // Update existing alert
        const updatedAlert = await updateAlertWithoutRefresh(editAlertId, newAlert);
        showSuccess(`Alert for ${newAlert.symbol} updated successfully`);
        // Exit edit mode
        setEditMode(false);
        setEditAlertId(null);
      } else {
        // Create new alert
        await createAlertWithoutRefresh({
          ...newAlert,
          skipTestNotification: true
        });
        showSuccess(`Alert for ${newAlert.symbol} created successfully`);
      }
      
      // Reset form
      setNewAlert({
        symbol: 'BTCUSDT',
        type: 'price',
        condition: 'above',
        value: '',
        notifyDiscord: true
      });
    } catch (error) {
      showError(`Error ${editMode ? 'updating' : 'creating'} alert: ${error.message}`)
    }
  }

  const handleEditClick = (alert) => {
    // Set form to edit mode with alert data
    setNewAlert({
      symbol: alert.symbol,
      type: alert.type,
      condition: alert.condition,
      value: alert.value,
      notifyDiscord: alert.notifyDiscord
    });
    setEditMode(true);
    setEditAlertId(alert.id);
  };
  
  const handleCancelEdit = () => {
    // Exit edit mode and reset form
    setEditMode(false);
    setEditAlertId(null);
    setNewAlert({
      symbol: 'BTCUSDT',
      type: 'price',
      condition: 'above',
      value: '',
      notifyDiscord: true
    });
  };

  const handleDeleteClick = (alertId) => {
    setConfirmDialog({
      open: true,
      alertId
    });
  };

  const handleConfirmDelete = async () => {
    const alertId = confirmDialog.alertId;
    
    try {
      await deleteAlert(alertId);
      showSuccess('Alert deleted successfully');
      
      // Close the dialog
      setConfirmDialog({ open: false, alertId: null });
      
      // Update local state
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      showError(`Failed to delete alert: ${error.message}`);
    }
  };
  
  const handleCancelDelete = () => {
    setConfirmDialog({ open: false, alertId: null });
  };

  const handleTestAlert = async () => {
    try {
      setIsTestingAlert(true)
      const result = await sendTestAlert(newAlert.symbol)
      showSuccess(`Test alert sent to Discord for ${newAlert.symbol}! ${result.message || ''}`)
    } catch (error) {
      showError(`Error sending test alert: ${error.message}`)
      console.error('Test alert error:', error)
    } finally {
      setIsTestingAlert(false)
    }
  }

  const handleResetAlert = (alertId) => {
    // Reset the alert so it can be triggered again
    resetTriggeredAlert(alertId);
    showInfo("Alert reset - it will trigger again when condition is met");
  };

  // Add a function to run the diagnostic tests
  const runDiagnosticTest = async () => {
    try {
      // Start with a simple alert
      const testAlert = {
        symbol: newAlert.symbol,
        condition: newAlert.condition,
        value: newAlert.value || '10000' // Use the current value or a default
      };
      
      showInfo("Running diagnostic tests, check console for detailed logs...");
      console.log("🔍 DIAGNOSTIC TEST STARTED", testAlert);
      
      setIsTestingAlert(true);
      
      // Run the diagnostic
      const result = await triggerAlertTest(
        testAlert.symbol,
        testAlert.condition,
        testAlert.value
      );
      
      console.log("🔍 DIAGNOSTIC TEST RESULT:", result);
      
      if (result.success) {
        showSuccess(`Diagnostic test completed. See console for details.`);
      } else {
        showError(`Diagnostic test failed: ${result.error}`);
      }
    } catch (error) {
      console.error("🔍 DIAGNOSTIC TEST ERROR:", error);
      showError(`Diagnostic test error: ${error.message}`);
    } finally {
      setIsTestingAlert(false);
    }
  };

  // Add an information section to explain that alerts work across all symbols
  return (
    <div className={`alerts-panel ${isDarkMode ? 'dark' : 'light'} ${compact ? 'compact' : 'full'}`}>
      <h2 className="alerts-title">Price Alerts</h2>
      
      {!compact && (
        <div className="alerts-info-banner">
          <p>Alerts are monitored for all cryptocurrencies, even when viewing a different chart.</p>
        </div>
      )}
      
      {/* Only show the form in full mode */}
      {!compact && (
        <div className="alerts-form">
          <div className="alerts-form-row">
            <div className="form-group">
              <label>Symbol</label>
              <select name="symbol" value={newAlert.symbol} onChange={handleInputChange}>
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
                <option value="DOGEUSDT">DOGE/USDT</option>
                <option value="AVAXUSDT">AVAX/USDT</option>
                <option value="BCHUSDT">BCH/USDT</option>
                <option value="LTCUSDT">LTC/USDT</option>
                <option value="ADAUSDT">ADA/USDT</option>
                <option value="DOTUSDT">DOT/USDT</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Type</label>
              <select name="type" value={newAlert.type} onChange={handleInputChange}>
                <option value="price">Price</option>
                <option value="volume">Volume</option>
                <option value="ma_cross">MA Cross</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Condition</label>
              <select name="condition" value={newAlert.condition} onChange={handleInputChange}>
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="crosses">Crosses</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Value</label>
              <input 
                name="value" 
                value={newAlert.value} 
                onChange={handleInputChange}
                placeholder="e.g. 50000"
              />
            </div>
          </div>
          
          <div className="alerts-form-row">
            <div className="form-group switch-group">
              <label htmlFor="discord-notify">Notify Discord</label>
              <input 
                type="checkbox"
                id="discord-notify" 
                name="notifyDiscord"
                checked={newAlert.notifyDiscord}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="alerts-form-row actions-row">
              <button 
                className="btn-primary create-alert-btn"
                onClick={handleCreateAlert}
                disabled={!newAlert.value}
              >
                {editMode ? 'Update Alert' : 'Create Alert'}
              </button>
              
              {editMode && (
                <button 
                  className="btn-outline cancel-btn"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
              
              {!editMode && (
                <>
                  <button 
                    className="btn-outline test-alert-btn"
                    onClick={handleTestAlert}
                    disabled={isTestingAlert}
                  >
                    {isTestingAlert ? 'Sending...' : 'Test Discord Alert'}
                    <FaBell className="btn-icon" />
                  </button>
                  
                  {/* Add diagnostic button */}
                  <button 
                    className="btn-outline diagnostic-btn"
                    onClick={runDiagnosticTest}
                    disabled={isTestingAlert}
                  >
                    Run Diagnostics
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="alerts-table-container">
        <table className="alerts-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Condition</th>
              <th>Value</th>
              <th>Discord</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(alert => (
              <tr key={alert.id} className={confirmDialog.alertId === alert.id ? "highlighted-row" : ""}>
                <td>{alert.symbol}</td>
                <td>{alert.type} {alert.condition}</td>
                <td>{alert.value}</td>
                <td>{alert.notifyDiscord ? "Yes" : "No"}</td>
                <td>
                  {alert.status}
                  {triggeredAlerts && triggeredAlerts[alert.id] && 
                    <span className="triggered-indicator"> (Triggered)</span>
                  }
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-icon edit-btn"
                      onClick={() => handleEditClick(alert)}
                      title="Edit alert"
                    >
                      <FaEdit />
                    </button>
                    
                    {triggeredAlerts && triggeredAlerts[alert.id] && (
                      <button
                        className="btn-icon reset-btn"
                        onClick={() => handleResetAlert(alert.id)}
                        title="Reset alert"
                      >
                        <FaBell />
                      </button>
                    )}
                    
                    <button
                      className="btn-icon delete-btn"
                      onClick={() => handleDeleteClick(alert.id)}
                      title="Delete alert"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCancelDelete}
      >
        <DialogTitle>Delete Alert</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this alert? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default AlertsPanel;
