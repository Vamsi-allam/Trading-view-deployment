import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { FaTimes, FaEdit } from 'react-icons/fa';
import { formatPrice } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { useTradingContext } from '../context/TradingContext';
import { styled } from '@mui/material/styles';
import './PositionsPanel.css';

// Add liquidation price calculator function
const calculateLiquidationPrice = (entryPrice, leverage, direction, maintenanceMargin = 0.01) => {
  if (direction === 'buy') {
    return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
  } else {
    return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }
};

// Add styled components for Material-UI
const StyledDialog = styled(Dialog)(({ theme, darkMode }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '12px',
    background: darkMode ? '#1a1a1a' : '#ffffff',
    border: `1px solid ${darkMode ? '#2d3748' : '#e2e8f0'}`,
    boxShadow: darkMode 
      ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
      : '0 4px 20px rgba(0, 0, 0, 0.15)',
    maxWidth: '450px',
    width: '100%',
    margin: '16px'
  }
}));

const StyledDialogContent = styled(DialogContent)(({ darkMode }) => ({
  padding: '24px',
  backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
  color: darkMode ? '#f7fafc' : '#2d3748'
}));

const PreviewRow = styled('div')(({ darkMode }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: `1px solid ${darkMode ? '#2d3748' : '#e2e8f0'}`,
  '& .label': {
    color: darkMode ? '#a0aec0' : '#718096',
    fontSize: '0.9rem'
  },
  '& .value': {
    fontWeight: 500,
    color: darkMode ? '#f7fafc' : '#2d3748'
  }
}));

const PositionsPanel = () => {
  const { isDarkMode } = useTheme();
  const { positions, closePosition, cancelOrder, modifyPositionTpSl } = useTradingContext();
  const [selectedTab, setSelectedTab] = useState('open');
  const [modifyDialog, setModifyDialog] = useState({ open: false, position: null });
  const [newTakeProfit, setNewTakeProfit] = useState('');
  const [newStopLoss, setNewStopLoss] = useState('');
  // Add state for validation errors
  const [errors, setErrors] = useState({ takeProfit: '', stopLoss: '' });

  // Filter positions based on selected tab
  const filteredPositions = positions.filter(position => {
    if (selectedTab === 'open') return position.status === 'open';
    if (selectedTab === 'pending') return position.status === 'pending';
    return true; // 'all' tab
  });
  
  // Format profit/loss with color
  const formatPnL = (pnl) => {
    const formattedValue = parseFloat(pnl).toFixed(2);
    const className = pnl >= 0 ? 'profit' : 'loss';
    return <span className={className}>${Math.abs(formattedValue)}</span>;
  };
  
  // Handle closing a position
  const handleClosePosition = (position) => {
    // Use the current price from the position object for closing
    if (position.currentPrice) {
      closePosition(position.id, position.currentPrice);
    }
  };
  
  // Handle canceling a pending order
  const handleCancelOrder = (orderId) => {
    cancelOrder(orderId);
  };
  
  // Update formatNumber to handle null/undefined values
  const formatNumber = (value, symbol) => {
    if (!value && value !== 0) return '-';
    // Use formatPrice utility for prices when symbol is provided
    if (symbol) {
      return formatPrice(value, symbol);
    }
    // Otherwise use default formatting
    const num = parseFloat(value);
    if (Math.abs(num) < 1) {
      return num.toFixed(5);
    }
    return num.toFixed(2);
  };
  
  const handleModifyClick = (position) => {
    setModifyDialog({
      open: true,
      position
    });
    setNewTakeProfit(position.takeProfit?.toString() || '');
    setNewStopLoss(position.stopLoss?.toString() || '');
    // Reset errors when opening dialog
    setErrors({ takeProfit: '', stopLoss: '' });
  };

  // Validate take profit and stop loss values
  const validateTpSl = () => {
    if (!modifyDialog.position) return false;
    
    const { direction, entryPrice, currentPrice } = modifyDialog.position;
    const tp = parseFloat(newTakeProfit);
    const sl = parseFloat(newStopLoss);
    let isValid = true;
    const newErrors = { takeProfit: '', stopLoss: '' };
    
    // Validate take profit if it's provided
    if (newTakeProfit && !isNaN(tp)) {
      if (direction === 'buy' && tp <= entryPrice) {
        newErrors.takeProfit = 'Take profit must be greater than entry price';
        isValid = false;
      } else if (direction === 'sell' && tp >= entryPrice) {
        newErrors.takeProfit = 'Take profit must be less than entry price';
        isValid = false;
      }
    }
    
    // Validate stop loss if it's provided
    if (newStopLoss && !isNaN(sl)) {
      if (direction === 'buy' && sl >= entryPrice) {
        newErrors.stopLoss = 'Stop loss must be less than entry price';
        isValid = false;
      } else if (direction === 'sell' && sl <= entryPrice) {
        newErrors.stopLoss = 'Stop loss must be greater than entry price';
        isValid = false;
      }
    }
    
    setErrors(newErrors);
    return isValid;
  };

  const handleModifyConfirm = () => {
    if (!modifyDialog.position) return;
    
    // Validate TP/SL values before updating
    if (!validateTpSl()) {
      return;
    }
    
    modifyPositionTpSl(
      modifyDialog.position.id,
      newTakeProfit || null,
      newStopLoss || null
    );
    
    setModifyDialog({ open: false, position: null });
  };

  return (
    <div className={`positions-panel ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="positions-header">
        <h3>Positions & Orders</h3>
        <div className="tab-selector">
          <button 
            className={`tab-btn ${selectedTab === 'open' ? 'active' : ''}`}
            onClick={() => setSelectedTab('open')}
          >
            Open
          </button>
          <button 
            className={`tab-btn ${selectedTab === 'pending' ? 'active' : ''}`}
            onClick={() => setSelectedTab('pending')}
          >
            Pending
          </button>
          <button 
            className={`tab-btn ${selectedTab === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedTab('all')}
          >
            All
          </button>
        </div>
      </div>
      
      {filteredPositions.length > 0 ? (
        <div className="positions-table-container">
          <table className="positions-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Size</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>TP/SL</th>
                <th>Liq. Price</th>
                <th>PnL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map(position => (
                <tr key={position.id} className={position.status === 'pending' ? 'pending-row' : ''}>
                  <td>{position.symbol}</td>
                  <td className={position.direction === 'buy' ? 'buy' : 'sell'}>
                    {position.direction.toUpperCase()} {position.leverage}x
                  </td>
                  <td>{formatNumber(position.quantity)}</td>
                  <td>${formatPrice(position.entryPrice, position.symbol)}</td>
                  <td>
                    {position.status === 'open' ? 
                      `$${formatPrice(position.currentPrice, position.symbol)}` : 
                      `$${formatPrice(position.entryPrice, position.symbol)} (Limit)`}
                  </td>
                  <td className="tp-sl-column">
                    <div className="tp-sl-values">
                      <span className="tp" title="Take Profit">
                        TP: {formatPrice(position.takeProfit, position.symbol)}
                      </span>
                      <span className="sl" title="Stop Loss">
                        SL: {formatPrice(position.stopLoss, position.symbol)}
                      </span>
                    </div>
                  </td>
                  <td className="liquidation-price">
                    ${formatPrice(calculateLiquidationPrice(
                      position.entryPrice,
                      position.leverage,
                      position.direction
                    ), position.symbol)}
                  </td>
                  <td>
                    {position.status === 'open' ? formatPnL(position.pnl) : '-'}
                  </td>
                  <td>
                    {position.status === 'open' ? (
                      <div className="action-buttons">
                        <button
                          className="modify-btn"
                          onClick={() => handleModifyClick(position)}
                          title="Modify TP/SL"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="close-position-btn" 
                          onClick={() => handleClosePosition(position)}
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="cancel-order-btn" 
                        onClick={() => handleCancelOrder(position.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-positions">
          <p>No {selectedTab} positions or orders found.</p>
        </div>
      )}

      {/* Replace existing Dialog with styled version */}
      <StyledDialog
        open={modifyDialog.open}
        onClose={() => setModifyDialog({ open: false, position: null })}
        maxWidth="sm"
        fullWidth
        darkMode={isDarkMode}
      >
        <DialogTitle>
          <span style={{ 
            color: modifyDialog.position?.direction === 'buy' ? '#38a169' : '#e53e3e',
            marginRight: '8px' 
          }}>
            {modifyDialog.position?.direction === 'buy' ? '⬆' : '⬇'}
          </span>
          Modify Position - {modifyDialog.position?.symbol}
        </DialogTitle>

        <StyledDialogContent darkMode={isDarkMode}>
          <PreviewRow darkMode={isDarkMode}>
            <span className="label">Entry Price</span>
            <span className="value">
              ${formatPrice(modifyDialog.position?.entryPrice || 0, modifyDialog.position?.symbol)}
            </span>
          </PreviewRow>

          <PreviewRow darkMode={isDarkMode}>
            <span className="label">Current Price</span>
            <span className="value">
              ${formatPrice(modifyDialog.position?.currentPrice || 0, modifyDialog.position?.symbol)}
            </span>
          </PreviewRow>

          <PreviewRow darkMode={isDarkMode}>
            <span className="label">Leverage</span>
            <span className="value">{modifyDialog.position?.leverage}×</span>
          </PreviewRow>

          <PreviewRow darkMode={isDarkMode}>
            <span className="label">Est. Liquidation</span>
            <span className="value" style={{ color: '#e53e3e' }}>
              ${formatPrice(calculateLiquidationPrice(
                modifyDialog.position?.entryPrice || 0,
                modifyDialog.position?.leverage || 1,
                modifyDialog.position?.direction || 'buy'
              ), modifyDialog.position?.symbol)}
            </span>
          </PreviewRow>

          <div className="modify-inputs" style={{ marginTop: '20px' }}>
            <div className="input-group">
              <label>Take Profit</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  value={newTakeProfit}
                  onChange={(e) => setNewTakeProfit(e.target.value)}
                  placeholder="Enter take profit price"
                  step="0.0001"
                  style={{
                    backgroundColor: isDarkMode ? '#2d3748' : '#ffffff',
                    color: isDarkMode ? '#f7fafc' : '#2d3748',
                    border: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
                    borderColor: errors.takeProfit ? '#e53e3e' : undefined
                  }}
                />
              </div>
              {errors.takeProfit && (
                <div className="input-error" style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '4px' }}>
                  {errors.takeProfit}
                </div>
              )}
            </div>

            <div className="input-group" style={{ marginTop: '16px' }}>
              <label>Stop Loss</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  value={newStopLoss}
                  onChange={(e) => setNewStopLoss(e.target.value)}
                  placeholder="Enter stop loss price"
                  step="0.0001"
                  style={{
                    backgroundColor: isDarkMode ? '#2d3748' : '#ffffff',
                    color: isDarkMode ? '#f7fafc' : '#2d3748',
                    border: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
                    borderColor: errors.stopLoss ? '#e53e3e' : undefined
                  }}
                />
              </div>
              {errors.stopLoss && (
                <div className="input-error" style={{ color: '#e53e3e', fontSize: '0.8rem', marginTop: '4px' }}>
                  {errors.stopLoss}
                </div>
              )}
            </div>
          </div>
        </StyledDialogContent>

        <DialogActions sx={{ 
          padding: '20px 24px',
          borderTop: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
          gap: '12px'
        }}>
          <Button
            variant="outlined"
            onClick={() => setModifyDialog({ open: false, position: null })}
            sx={{
              borderColor: isDarkMode ? '#4a5568' : '#e2e8f0',
              color: isDarkMode ? '#f7fafc' : '#4a5568',
              '&:hover': {
                borderColor: isDarkMode ? '#718096' : '#cbd5e0',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleModifyConfirm}
            sx={{
              backgroundColor: '#3182ce',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#2c5282'
              }
            }}
          >
            Update Position
          </Button>
        </DialogActions>
      </StyledDialog>
    </div>
  );
};

export default PositionsPanel;
