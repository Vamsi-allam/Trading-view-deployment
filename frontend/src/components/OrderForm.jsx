import { useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { useTradingContext } from '../context/TradingContext';
import { useSnackbar } from '../context/SnackbarContext';
import './OrderForm.css';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

// Update lot size configuration for more intuitive lot-to-quantity conversion
const LOT_SIZES = {
  'BTCUSDT': 0.001,    // 1000 lots = 1 BTC
  'ETHUSDT': 0.01,     // 100 lots = 1 ETH
  'SOLUSDT': 1,      // 10 lots = 1 SOL
  'BNBUSDT': 0.1,      // 10 lots = 1 BNB (updated from 0.01)
  'XRPUSDT': 1,       // 1 lot = 1 XRP
  'DOGEUSDT': 100,      // 1 lot = 100 DOGE
  'AVAXUSDT': 1,       // 1 lot = 1 AVAX
  'BCHUSDT': 0.01,      // 100 lots = 1 BCH
  'LTCUSDT': 0.1,      // 10 lots = 1 LTC
  'ADAUSDT': 1,       // 1 lot = 1 ADA
  'DOTUSDT': 1,       // 1 lot = 1 DOT
};

// Update minimum quantities
const MIN_QUANTITIES = {
  'BTCUSDT': 0.001,    // Minimum 1 lot
  'ETHUSDT': 0.01,     // Minimum 1 lot
  'SOLUSDT': 1,      // Minimum 1 lot
  'BNBUSDT': 0.1,      // Minimum 1 lot (updated from 0.01)
  'XRPUSDT': 1,       // Minimum 1 lot
  'DOGEUSDT': 100,      // Minimum 1 lot
  'AVAXUSDT': 1,      // Minimum 1 lot
  'BCHUSDT': 0.01,      // Minimum 1 lot
  'LTCUSDT': 0.1,      // Minimum 1 lot
  'ADAUSDT': 1,      // Minimum 1 lot
  'DOTUSDT': 1,      // Minimum 1 lot
};

// Add price precision for each symbol
const PRICE_PRECISION = {
  'BTCUSDT': 2,    // Show prices as XX,XXX.XX
  'ETHUSDT': 2,    // Show prices as X,XXX.XX
  'SOLUSDT': 3,    // Show prices as XXX.XXX
  'BNBUSDT': 2,    // Show prices as XXX.XX
  'XRPUSDT': 4,    // Show prices as XX.XXXX
  'DOGEUSDT': 5,    // Show prices as 0.XXXXX
  'AVAXUSDT': 3,   // Show prices as XX.XXX
  'BCHUSDT': 2,     // Show prices as XXX.XX
  'LTCUSDT': 2,     // Show prices as XXX.XX
  'ADAUSDT': 4,     // Show prices as XX.XXXX
  'DOTUSDT': 3,     // Show prices as XX.XXX
};

// Add quantity precision for each symbol
const QUANTITY_PRECISION = {
  'BTCUSDT': 3,    // 0.001 precision
  'ETHUSDT': 2,    // 0.01 precision
  'SOLUSDT': 1,    // 0.1 precision
  'BNBUSDT': 2,    // 0.01 precision
  'XRPUSDT': 0,    // 1 precision
  'DOGEUSDT': 0,    // 1 precision
  'AVAXUSDT': 0,    // 0.1 precision
  'BCHUSDT': 2,    // 0.01 precision
  'LTCUSDT': 1,    // 0.1 precision
  'ADAUSDT': 0,    // 1 precision
  'DOTUSDT': 0,    // 1 precision
};

// Add function to calculate liquidation price
const calculateLiquidationPrice = (entryPrice, leverage, direction, maintenanceMargin = 0.01) => {
  if (direction === 'buy') {
    return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
  } else {
    return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }
};

// Styled components for Material-UI - update to filter custom props
const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode'
})(({ theme, isDarkMode }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '12px',
    background: isDarkMode ? '#1a1a1a' : '#ffffff',
    border: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
    boxShadow: isDarkMode 
      ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
      : '0 4px 20px rgba(0, 0, 0, 0.15)',
    maxWidth: '450px',
    width: '100%',
    margin: '16px'
  },
  '& .MuiBackdrop-root': {
    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(3px)'
  }
}));

const StyledDialogTitle = styled(DialogTitle, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode'
})(({ theme, isDarkMode }) => ({
  borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
  padding: '24px',
  color: isDarkMode ? '#f7fafc' : '#2d3748',
  '& h2': {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }
}));

const StyledDialogContent = styled(DialogContent, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode'
})(({ theme, isDarkMode }) => ({
  padding: '24px',
  '& > div:not(:last-child)': {
    marginBottom: '12px'
  },
  backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
}));

const PreviewRow = styled('div', {
  shouldForwardProp: (prop) => prop !== 'isDarkMode'
})(({ theme, isDarkMode }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
  '&:last-child': {
    borderBottom: 'none'
  },
  '& .label': {
    color: isDarkMode ? '#a0aec0' : '#718096',
    fontSize: '0.9rem'
  },
  '& .value': {
    fontWeight: 500,
    color: isDarkMode ? '#f7fafc' : '#2d3748'
  }
}));

const OrderForm = ({ symbol, currentPrice, direction = 'buy', onClose }) => {
  const { isDarkMode } = useTheme();
  const { balance, executeTrade } = useTradingContext();
  const { showSuccess, showError } = useSnackbar();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Form state
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [canExecute, setCanExecute] = useState(false);
  const [calculatedMargin, setCalculatedMargin] = useState(0);
  
  // Add state for lots
  const [lots, setLots] = useState('1');

  // Add state to track if limit price was initialized
  const [limitPriceInitialized, setLimitPriceInitialized] = useState(false);

  // Add state for confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Add state for validation errors
  const [errors, setErrors] = useState({
    takeProfit: '',
    stopLoss: ''
  });
  
  // Modify the limit price initialization effect
  useEffect(() => {
    // Only set limit price when switching to limit mode and not yet initialized
    if (orderType === 'limit' && currentPrice && !limitPriceInitialized) {
      setLimitPrice(currentPrice.toString());
      setLimitPriceInitialized(true);
    }
    // Reset initialization flag when switching back to market
    if (orderType === 'market') {
      setLimitPriceInitialized(false);
    }
  }, [orderType, currentPrice, limitPriceInitialized]);
  
  // Update quantity when lots change
  useEffect(() => {
    const lotSize = LOT_SIZES[symbol] || 1;
    const newQuantity = (parseFloat(lots) || 0) * lotSize;
    // Round to the correct precision for the symbol
    const precision = QUANTITY_PRECISION[symbol] || 8;
    setQuantity(newQuantity.toFixed(precision));
  }, [lots, symbol]);
  
  // Calculate margin and check if trade can be executed
  useEffect(() => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice);
    const qty = parseFloat(quantity) || 0;
    const lev = parseInt(leverage) || 1;
    
    if (price && qty > 0) {
      const margin = (price * qty) / lev;
      setCalculatedMargin(margin);
      setCanExecute(margin <= balance && margin > 0);
    } else {
      setCalculatedMargin(0);
      // Only set canExecute to false if quantity is entered but margin is too high
      setCanExecute(qty === 0); // Allow execution when no quantity is entered yet
    }
  }, [orderType, limitPrice, quantity, leverage, currentPrice, balance]);
  
  // Validate TP/SL values when they change or when price/direction changes
  useEffect(() => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice || 0);
    const tp = parseFloat(takeProfit);
    const sl = parseFloat(stopLoss);
    const newErrors = { takeProfit: '', stopLoss: '' };
    
    if (takeProfit && !isNaN(tp)) {
      if (direction === 'buy' && tp <= price) {
        newErrors.takeProfit = 'Take profit must be greater than entry price for buy orders';
      } else if (direction === 'sell' && tp >= price) {
        newErrors.takeProfit = 'Take profit must be less than entry price for sell orders';
      }
    }
    
    if (stopLoss && !isNaN(sl)) {
      if (direction === 'buy' && sl >= price) {
        newErrors.stopLoss = 'Stop loss must be less than entry price for buy orders';
      } else if (direction === 'sell' && sl <= price) {
        newErrors.stopLoss = 'Stop loss must be greater than entry price for sell orders';
      }
    }
    
    setErrors(newErrors);
  }, [takeProfit, stopLoss, direction, currentPrice, limitPrice, orderType]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canExecute) return;
    
    // Check for validation errors
    if (errors.takeProfit || errors.stopLoss) {
      showError('Please fix the validation errors before placing the order');
      return;
    }
    
    // Show confirmation dialog instead of executing trade immediately
    setShowConfirmation(true);
  };
  
  const handleConfirmOrder = () => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice);
    
    try {
      const tradeResult = executeTrade({
        symbol,
        direction,
        quantity: parseFloat(quantity),
        entryPrice: price,
        leverage: parseInt(leverage),
        orderType,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null
      });
      
      if (tradeResult) {
        setShowConfirmation(false);
        setQuantity('');
        setTakeProfit('');
        setStopLoss('');
        showSuccess(`${direction === 'buy' ? 'Buy' : 'Sell'} order placed successfully`);
      }
    } catch (error) {
      showError(`Failed to place order: ${error.message}`);
    }
  };
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Update the price formatting function to handle small numbers better
  const formatPrice = (price, symbol) => {
    const numPrice = parseFloat(price);
    // For very small numbers (e.g., DOGE), show more decimals
    if (Math.abs(numPrice) < 1) {
      return numPrice.toFixed(5);
    }
    const precision = PRICE_PRECISION[symbol] || 2;
    return numPrice.toFixed(precision);
  };
  
  return (
    <div className="order-form-wrapper">
      <div className={`order-form-panel ${isDarkMode ? 'dark' : 'light'} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="toggle-button" onClick={toggleCollapse}>
          {isCollapsed ? <FaChevronLeft /> : <FaChevronRight />}
        </div>
        
        {!isCollapsed && (
          <div className="order-form">
            <div className="order-form-header">
              <h3>{direction === 'buy' ? 'Buy' : 'Sell'} {symbol}</h3>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="orderType">Order Type</label>
                <div className="order-type-selector">
                  <button
                    type="button"
                    className={`order-type-btn ${orderType === 'market' ? 'active' : ''}`}
                    onClick={() => setOrderType('market')}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    className={`order-type-btn ${orderType === 'limit' ? 'active' : ''}`}
                    onClick={() => setOrderType('limit')}
                  >
                    Limit
                  </button>
                </div>
              </div>
              
              {orderType === 'limit' && (
                <div className="form-group">
                  <label htmlFor="limitPrice">Limit Price</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      id="limitPrice"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      step="0.0001"
                      min="0"
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="lots">Lots</label>
                <input
                  type="number"
                  id="lots"
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  step="1"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="quantity">
                  Quantity ({symbol.replace('USDT', '')})
                  <span className="lot-size-info">
                    (1 Lot = {parseFloat(LOT_SIZES[symbol]).toFixed(5)} {symbol.replace('USDT', '')})
                  </span>
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity && !isNaN(parseFloat(quantity)) ? parseFloat(quantity).toFixed(5) : "0.00000"}
                  readOnly
                  disabled
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="leverage">Leverage</label>
                <div className="leverage-selector">
                  {[1, 2, 5, 10, 25, 50, 100].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      className={`leverage-btn ${parseInt(leverage) === lev ? 'active' : ''}`}
                      onClick={() => setLeverage(lev)}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="takeProfit">Take Profit</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      id="takeProfit"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      step="0.0001"
                      min="0"
                      placeholder="Optional"
                      className={errors.takeProfit ? 'error-input' : ''}
                    />
                  </div>
                  {errors.takeProfit && (
                    <div className="input-error">{errors.takeProfit}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="stopLoss">Stop Loss</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">$</span>
                    <input
                      type="number"
                      id="stopLoss"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      step="0.0001"
                      min="0"
                      placeholder="Optional"
                      className={errors.stopLoss ? 'error-input' : ''}
                    />
                  </div>
                  {errors.stopLoss && (
                    <div className="input-error">{errors.stopLoss}</div>
                  )}
                </div>
              </div>
              
              <div className="order-summary">
                <div className="summary-row">
                  <span>Order Value:</span>
                  <span>${((parseFloat(quantity) || 0) * (orderType === 'market' ? currentPrice : parseFloat(limitPrice) || 0)).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Required Margin:</span>
                  <span className={canExecute ? '' : 'error'}>${calculatedMargin.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Available Balance:</span>
                  <span>${balance.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="order-actions">
                <button
                  type="submit"
                  className={`submit-btn ${direction === 'buy' ? 'buy' : 'sell'}`}
                  disabled={!quantity || !canExecute || errors.takeProfit || errors.stopLoss}
                >
                  Place Order
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
              
              {quantity && !canExecute && ( // Only show error if quantity is entered and can't execute
                <div className="error-message">
                  Insufficient balance for this trade.
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Replace the existing confirmation dialog with Material-UI Dialog */}
      <StyledDialog
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        maxWidth="sm"
        fullWidth
        isDarkMode={isDarkMode}
      >
        <StyledDialogTitle isDarkMode={isDarkMode}>
          <span style={{ 
            color: direction === 'buy' ? '#38a169' : '#e53e3e',
            marginRight: '8px' 
          }}>
            {direction === 'buy' ? '⬆' : '⬇'}
          </span>
          Confirm {direction === 'buy' ? 'Buy' : 'Sell'} {orderType} Order
        </StyledDialogTitle>
        <StyledDialogContent isDarkMode={isDarkMode}>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Symbol</span>
            <span className="value">{symbol}</span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Order Type</span>
            <span className="value" style={{ 
              color: orderType === 'market' ? '#3182ce' : '#6b46c1'
            }}>
              {orderType.toUpperCase()}
            </span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Position Size</span>
            <span className="value">{quantity} {symbol.replace('USDT', '')}</span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Entry Price</span>
            <span className="value" style={{ fontFamily: 'monospace' }}>
              ${formatPrice(orderType === 'market' ? currentPrice : limitPrice, symbol)}
            </span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Leverage</span>
            <span className="value" style={{ color: parseInt(leverage) > 10 ? '#e53e3e' : undefined }}>
              {leverage}×
            </span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Required Margin</span>
            <span className="value" style={{ fontFamily: 'monospace' }}>
              ${calculatedMargin.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </PreviewRow>
          <PreviewRow isDarkMode={isDarkMode}>
            <span className="label">Est. Liquidation</span>
            <span className="value" style={{ 
              color: '#e53e3e',
              fontFamily: 'monospace',
              fontWeight: 600 
            }}>
              ${calculateLiquidationPrice(
                orderType === 'market' ? currentPrice : parseFloat(limitPrice),
                parseInt(leverage),
                direction
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </PreviewRow>
        </StyledDialogContent>
        <DialogActions sx={{ 
          padding: '20px 24px',
          gap: '12px',
          borderTop: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'
        }}>
          <Button
            variant="outlined"
            onClick={() => setShowConfirmation(false)}
            sx={{
              borderColor: isDarkMode ? '#4a5568' : '#e2e8f0',
              color: isDarkMode ? '#f7fafc' : '#4a5568',
              '&:hover': {
                borderColor: isDarkMode ? '#718096' : '#cbd5e0',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
              },
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmOrder}
            sx={{
              backgroundColor: direction === 'buy' ? '#38a169' : '#e53e3e',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: direction === 'buy' ? '#2f855a' : '#c53030'
              },
              textTransform: 'none',
              fontWeight: 500,
              padding: '8px 24px'
            }}
          >
            Confirm {direction === 'buy' ? 'Buy' : 'Sell'}
          </Button>
        </DialogActions>
      </StyledDialog>
    </div>
  );
};

export default OrderForm;
