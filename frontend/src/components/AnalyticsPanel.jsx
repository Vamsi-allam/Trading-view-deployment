import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTradingContext } from '../context/TradingContext';
import './AnalyticsPanel.css';

const AnalyticsPanel = () => {
  const { isDarkMode } = useTheme();
  const { positions, tradeHistory, closePosition } = useTradingContext();
  const [tradeFilter, setTradeFilter] = useState('all'); // Add filter state
  
  // Get open positions
  const openPositions = positions.filter(p => p.status === 'open');
  
  // Calculate total PnL from closed trades
  const closedTradesPnL = tradeHistory
    .filter(t => t.type === 'close')
    .reduce((total, trade) => total + (trade.pnl || 0), 0);
  
  // Calculate win/loss ratio
  const winningTrades = tradeHistory.filter(t => t.type === 'close' && t.pnl > 0).length;
  const losingTrades = tradeHistory.filter(t => t.type === 'close' && t.pnl < 0).length;
  const winRate = tradeHistory.length > 0 
    ? Math.round((winningTrades / (winningTrades + losingTrades)) * 100) 
    : 0;
  
  // Handle closing a position
  const handleClosePosition = (position) => {
    if (position.currentPrice) {
      closePosition(position.id, position.currentPrice);
    }
  };
  
  // Filter trades based on selected filter
  const getFilteredTrades = () => {
    if (tradeFilter === 'buy') {
      return openPositions.filter(p => p.direction === 'buy');
    } else if (tradeFilter === 'sell') {
      return openPositions.filter(p => p.direction === 'sell');
    } else if (tradeFilter === 'profit') {
      return openPositions.filter(p => p.pnl > 0);
    } else if (tradeFilter === 'loss') {
      return openPositions.filter(p => p.pnl < 0);
    }
    return openPositions;
  };
  
  // Calculate positions statistics
  const filteredTrades = getFilteredTrades();
  const totalPositionValue = filteredTrades.reduce((sum, p) => 
    sum + (p.quantity * (p.currentPrice || p.entryPrice)), 0);
  const totalPnl = filteredTrades.reduce((sum, p) => sum + p.pnl, 0);
  const averageLeverage = filteredTrades.length ? 
    filteredTrades.reduce((sum, p) => sum + p.leverage, 0) / filteredTrades.length : 0;
  
  // Calculate PnL percentage for a position
  const calculatePnlPercentage = (position) => {
    if (!position.pnl) return 0;
    const positionValue = position.entryPrice * position.quantity;
    return (position.pnl / positionValue) * 100;
  };
  
  // Format number with appropriate precision
  const formatNumber = (value, precision = 2) => {
    if (!value && value !== 0) return '-';
    return parseFloat(value).toFixed(precision);
  };
  
  return (
    <div className={`analytics-panel ${isDarkMode ? 'dark' : 'light'}`}>
      <h2 className="panel-title">Analytics</h2>
      
      <div className="analytics-summary">
        <div className="summary-card">
          <h3>Active Trades</h3>
          <div className="card-value">{openPositions.length}</div>
        </div>
        
        <div className="summary-card">
          <h3>Total PnL</h3>
          <div className={`card-value ${closedTradesPnL >= 0 ? 'profit' : 'loss'}`}>
            {closedTradesPnL >= 0 ? '+' : '-'}${Math.abs(closedTradesPnL).toFixed(2)}
          </div>
        </div>
        
        <div className="summary-card">
          <h3>Win Rate</h3>
          <div className="card-value">{winRate}%</div>
          <div className="card-subtitle">
            {winningTrades} wins / {losingTrades} losses
          </div>
        </div>
        
        {/* Add new summary card for open position value */}
        <div className="summary-card">
          <h3>Position Value</h3>
          <div className="card-value">${totalPositionValue.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Add a new section for current position stats */}
      <div className="position-stats">
        <h3>Current Position Stats</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Open PnL:</span>
            <span className={`stat-value ${totalPnl >= 0 ? 'profit' : 'loss'}`}>
              {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg. Leverage:</span>
            <span className="stat-value">{averageLeverage.toFixed(1)}x</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Buy Positions:</span>
            <span className="stat-value">{openPositions.filter(p => p.direction === 'buy').length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Sell Positions:</span>
            <span className="stat-value">{openPositions.filter(p => p.direction === 'sell').length}</span>
          </div>
        </div>
      </div>
      
      <div className="active-trades-section">
        <div className="section-header">
          <h3>Current Trades</h3>
          <div className="trade-filters">
            <button 
              className={`filter-btn ${tradeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTradeFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${tradeFilter === 'buy' ? 'active' : ''}`}
              onClick={() => setTradeFilter('buy')}
            >
              Buy
            </button>
            <button 
              className={`filter-btn ${tradeFilter === 'sell' ? 'active' : ''}`}
              onClick={() => setTradeFilter('sell')}
            >
              Sell
            </button>
            <button 
              className={`filter-btn ${tradeFilter === 'profit' ? 'active' : ''}`}
              onClick={() => setTradeFilter('profit')}
            >
              Profit
            </button>
            <button 
              className={`filter-btn ${tradeFilter === 'loss' ? 'active' : ''}`}
              onClick={() => setTradeFilter('loss')}
            >
              Loss
            </button>
          </div>
        </div>
        
        {filteredTrades.length > 0 ? (
          <div className="trades-table-container">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Direction</th>
                  <th>Size</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>Leverage</th>
                  <th>Duration</th>
                  <th>PnL</th>
                  <th>PnL %</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map(position => {
                  const pnlPercentage = calculatePnlPercentage(position);
                  const openTime = new Date(position.openTime);
                  const now = new Date();
                  const durationMs = now - openTime;
                  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                  
                  return (
                    <tr key={position.id}>
                      <td>{position.symbol}</td>
                      <td className={position.direction === 'buy' ? 'buy' : 'sell'}>
                        {position.direction.toUpperCase()}
                      </td>
                      <td>{formatNumber(position.quantity, 5)}</td>
                      <td>${formatNumber(position.entryPrice)}</td>
                      <td>${formatNumber(position.currentPrice || position.entryPrice)}</td>
                      <td>{position.leverage}x</td>
                      <td>{durationHours}h {durationMinutes}m</td>
                      <td className={position.pnl >= 0 ? 'profit' : 'loss'}>
                        {position.pnl >= 0 ? '+' : '-'}${Math.abs(position.pnl).toFixed(2)}
                      </td>
                      <td className={pnlPercentage >= 0 ? 'profit' : 'loss'}>
                        {pnlPercentage >= 0 ? '+' : '-'}{Math.abs(pnlPercentage).toFixed(2)}%
                      </td>
                      <td>
                        <button 
                          className="close-trade-btn" 
                          onClick={() => handleClosePosition(position)}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-trades-message">
            <p>No {tradeFilter !== 'all' ? tradeFilter + ' ' : ''}trades found.</p>
          </div>
        )}
      </div>
      
      <div className="performance-metrics">
        <h3>Trading Performance</h3>
        
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-title">Avg. Profit</div>
            <div className="metric-value">
              ${Math.abs(
                tradeHistory
                  .filter(t => t.type === 'close' && t.pnl > 0)
                  .reduce((sum, t) => sum + t.pnl, 0) / 
                  Math.max(1, winningTrades)
              ).toFixed(2)}
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-title">Avg. Loss</div>
            <div className="metric-value">
              ${Math.abs(
                tradeHistory
                  .filter(t => t.type === 'close' && t.pnl < 0)
                  .reduce((sum, t) => sum + t.pnl, 0) / 
                  Math.max(1, losingTrades)
              ).toFixed(2)}
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-title">Total Trades</div>
            <div className="metric-value">
              {tradeHistory.filter(t => t.type === 'close').length}
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-title">Profit Factor</div>
            <div className="metric-value">
              {(() => {
                const grossProfit = tradeHistory
                  .filter(t => t.type === 'close' && t.pnl > 0)
                  .reduce((sum, t) => sum + t.pnl, 0);
                  
                const grossLoss = Math.abs(
                  tradeHistory
                    .filter(t => t.type === 'close' && t.pnl < 0)
                    .reduce((sum, t) => sum + t.pnl, 0)
                );
                
                return grossLoss === 0 ? 
                  grossProfit > 0 ? '∞' : '0' : 
                  (grossProfit / grossLoss).toFixed(2);
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
