import { createContext, useContext, useState, useEffect } from 'react';
import { useSnackbar } from './SnackbarContext';

const TradingContext = createContext();

export const useTradingContext = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTradingContext must be used within a TradingProvider');
  }
  return context;
};

export const TradingProvider = ({ children }) => {
  const { showSuccess, showError } = useSnackbar();
  
  // Load saved trading data from localStorage or use defaults
  const [balance, setBalance] = useState(() => {
    const savedBalance = localStorage.getItem('paperTradingBalance');
    return savedBalance ? parseFloat(savedBalance) : 10000;
  });
  
  const [positions, setPositions] = useState(() => {
    const savedPositions = localStorage.getItem('paperTradingPositions');
    return savedPositions ? JSON.parse(savedPositions) : [];
  });
  
  const [tradeHistory, setTradeHistory] = useState(() => {
    const savedHistory = localStorage.getItem('paperTradingHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('paperTradingBalance', balance.toString());
    localStorage.setItem('paperTradingPositions', JSON.stringify(positions));
    localStorage.setItem('paperTradingHistory', JSON.stringify(tradeHistory));
  }, [balance, positions, tradeHistory]);
  
  // Add a ref to track positions that are currently being closed
  const [closingPositions, setClosingPositions] = useState(new Set());
  
  // Add funds to balance
  const addFunds = (amount) => {
    if (amount <= 0) {
      showError('Please enter a valid amount');
      return false;
    }
    
    setBalance(prev => prev + amount);
    showSuccess(`Successfully added $${amount.toFixed(2)}`);
    return true;
  };
  
  // Withdraw funds from balance
  const withdrawFunds = (amount) => {
    if (amount <= 0) {
      showError('Please enter a valid amount');
      return false;
    }
    
    if (amount > balance) {
      showError('Insufficient funds');
      return false;
    }
    
    setBalance(prev => prev - amount);
    showSuccess(`Successfully withdrew $${amount.toFixed(2)}`);
    return true;
  };
  
  // Execute a trade (open position)
  const executeTrade = (tradeParams) => {
    const {
      symbol,
      direction, // 'buy' or 'sell'
      quantity,
      entryPrice,
      leverage = 1,
      orderType = 'market', // 'market' or 'limit'
      takeProfit = null,
      stopLoss = null
    } = tradeParams;
    
    // Calculate required margin
    const positionValue = entryPrice * quantity;
    const requiredMargin = positionValue / leverage;
    
    // Check if user has enough balance
    if (requiredMargin > balance) {
      showError(`Insufficient balance. Required: $${requiredMargin.toFixed(2)}`);
      return false;
    }
    
    // Create new position
    const newPosition = {
      id: Date.now().toString(),
      symbol,
      direction,
      quantity,
      entryPrice,
      leverage,
      orderType,
      takeProfit,
      stopLoss,
      openTime: new Date().toISOString(),
      margin: requiredMargin,
      pnl: 0,
      status: orderType === 'market' ? 'open' : 'pending'
    };
    
    // Add to positions
    setPositions(prev => [...prev, newPosition]);
    
    // Deduct margin from balance
    setBalance(prev => prev - requiredMargin);
    
    // Add to trade history for 'market' orders
    if (orderType === 'market') {
      const historyEntry = {
        id: newPosition.id,
        type: 'open',
        symbol,
        direction,
        quantity,
        price: entryPrice,
        leverage,
        time: new Date().toISOString(),
        margin: requiredMargin
      };
      
      setTradeHistory(prev => [...prev, historyEntry]);
    }
    
    showSuccess(`${orderType === 'market' ? 'Executed' : 'Placed'} ${direction} order for ${quantity} ${symbol}`);
    return newPosition;
  };
  
  // Close a position
  const closePosition = (positionId, closePrice) => {
    // Check if this position is already being closed
    if (closingPositions.has(positionId)) {
      console.log(`Position ${positionId} already being closed, skipping duplicate close`);
      return false;
    }
    
    // Find the position
    const position = positions.find(p => p.id === positionId);
    
    if (!position) {
      showError('Position not found');
      return false;
    }
    
    // Mark this position as being closed
    setClosingPositions(prev => {
      const updated = new Set(prev);
      updated.add(positionId);
      return updated;
    });
    
    // Calculate PnL
    const positionValue = position.entryPrice * position.quantity;
    const closeValue = closePrice * position.quantity;
    let pnl = 0;
    
    if (position.direction === 'buy') {
      pnl = closeValue - positionValue;
    } else {
      pnl = positionValue - closeValue;
    }
    
    // Create history entry
    const historyEntry = {
      id: Date.now().toString(),
      refId: position.id,
      type: 'close',
      symbol: position.symbol,
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      closePrice,
      leverage: position.leverage,
      time: new Date().toISOString(),
      pnl,
      margin: position.margin
    };
    
    // Add to trade history
    setTradeHistory(prev => [...prev, historyEntry]);
    
    // Return margin + PnL to balance
    setBalance(prev => prev + position.margin + pnl);
    
    // Remove from positions
    setPositions(prev => prev.filter(p => p.id !== positionId));
    
    // After a small delay, remove from closing positions set
    setTimeout(() => {
      setClosingPositions(prev => {
        const updated = new Set(prev);
        updated.delete(positionId);
        return updated;
      });
    }, 1000); // 1 second cooldown
    
    showSuccess(`Closed position with ${pnl >= 0 ? 'profit' : 'loss'} of $${Math.abs(pnl).toFixed(2)}`);
    return true;
  };
  
  // Update position PnL based on current price
  const updatePositionPnl = (symbol, currentPrice) => {
    // Create a list to track positions that need to be closed
    const positionsToClose = [];
    
    // First update PnL and identify positions to close, without closing them yet
    setPositions(prev => 
      prev.map(position => {
        if (position.symbol !== symbol || position.status !== 'open') {
          return position;
        }
        
        // Skip positions that are already being closed
        if (closingPositions.has(position.id)) {
          return position;
        }
        
        // Calculate PnL
        const positionValue = position.entryPrice * position.quantity;
        const currentValue = currentPrice * position.quantity;
        let pnl = 0;
        
        if (position.direction === 'buy') {
          pnl = currentValue - positionValue;
        } else {
          pnl = positionValue - currentValue;
        }
        
        // Check for take profit or stop loss
        let shouldClose = false;
        let closePrice = currentPrice;
        
        if (position.takeProfit !== null && position.direction === 'buy' && currentPrice >= position.takeProfit) {
          // Mark for closing at take profit
          shouldClose = true;
          closePrice = position.takeProfit;
        } 
        else if (position.takeProfit !== null && position.direction === 'sell' && currentPrice <= position.takeProfit) {
          // Mark for closing at take profit
          shouldClose = true;
          closePrice = position.takeProfit;
        }
        else if (position.stopLoss !== null && position.direction === 'buy' && currentPrice <= position.stopLoss) {
          // Mark for closing at stop loss
          shouldClose = true;
          closePrice = position.stopLoss;
        }
        else if (position.stopLoss !== null && position.direction === 'sell' && currentPrice >= position.stopLoss) {
          // Mark for closing at stop loss
          shouldClose = true;
          closePrice = position.stopLoss;
        }
        
        // If position should be closed, add to list of positions to close
        if (shouldClose) {
          positionsToClose.push({
            id: position.id,
            price: closePrice,
            reason: closePrice === position.takeProfit ? 'TP' : 'SL'
          });
        }
        
        // Update position with new PnL
        return {
          ...position,
          pnl,
          currentPrice
        };
      })
    );
    
    // After updating all positions, close the ones that hit TP/SL
    if (positionsToClose.length > 0) {
      // Use setTimeout to ensure state update has completed
      setTimeout(() => {
        positionsToClose.forEach(pos => {
          console.log(`Closing position ${pos.id} due to ${pos.reason} at price ${pos.price}`);
          closePosition(pos.id, pos.price);
        });
      }, 0);
    }
  };
  
  // Cancel pending order
  const cancelOrder = (orderId) => {
    const order = positions.find(p => p.id === orderId && p.status === 'pending');
    
    if (!order) {
      showError('Order not found');
      return false;
    }
    
    // Return margin to balance
    setBalance(prev => prev + order.margin);
    
    // Remove from positions
    setPositions(prev => prev.filter(p => p.id !== orderId));
    
    showSuccess('Order cancelled successfully');
    return true;
  };
  
  // Check if limit orders should be executed
  const checkLimitOrders = (symbol, currentPrice) => {
    const limitOrders = positions.filter(
      p => p.symbol === symbol && p.status === 'pending'
    );
    
    limitOrders.forEach(order => {
      // For buy limit orders, execute if price falls below limit price
      if (order.direction === 'buy' && order.orderType === 'limit' && currentPrice <= order.entryPrice) {
        executeOrder(order.id, currentPrice);
      }
      // For sell limit orders, execute if price rises above limit price
      else if (order.direction === 'sell' && order.orderType === 'limit' && currentPrice >= order.entryPrice) {
        executeOrder(order.id, currentPrice);
      }
    });
  };
  
  // Execute a pending order
  const executeOrder = (orderId, executionPrice) => {
    const order = positions.find(p => p.id === orderId && p.status === 'pending');
    
    if (!order) {
      return false;
    }
    
    // Update order status to open
    setPositions(prev => 
      prev.map(p => {
        if (p.id === orderId) {
          return {
            ...p,
            status: 'open',
            entryPrice: executionPrice,
            openTime: new Date().toISOString()
          };
        }
        return p;
      })
    );
    
    // Add to trade history
    const historyEntry = {
      id: Date.now().toString(),
      refId: order.id,
      type: 'open',
      symbol: order.symbol,
      direction: order.direction,
      quantity: order.quantity,
      price: executionPrice,
      leverage: order.leverage,
      time: new Date().toISOString(),
      margin: order.margin
    };
    
    setTradeHistory(prev => [...prev, historyEntry]);
    
    showSuccess(`Limit order executed: ${order.direction} ${order.quantity} ${order.symbol} at $${executionPrice}`);
    return true;
  };
  
  // Add new function to modify position take profit and stop loss
  const modifyPositionTpSl = (positionId, takeProfit, stopLoss) => {
    // Find the position
    const position = positions.find(p => p.id === positionId);
    
    if (!position) {
      showError('Position not found');
      return false;
    }
    
    // Update the position with new TP/SL values
    setPositions(prev => 
      prev.map(p => {
        if (p.id === positionId) {
          return {
            ...p,
            takeProfit: takeProfit ? parseFloat(takeProfit) : null,
            stopLoss: stopLoss ? parseFloat(stopLoss) : null
          };
        }
        return p;
      })
    );
    
    showSuccess(`Position ${position.symbol} TP/SL updated successfully`);
    return true;
  };
  
  const value = {
    balance,
    positions,
    tradeHistory,
    addFunds,
    withdrawFunds,
    executeTrade,
    closePosition,
    updatePositionPnl,
    cancelOrder,
    checkLimitOrders,
    modifyPositionTpSl
  };
  
  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};
