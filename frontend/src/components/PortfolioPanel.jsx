import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useTradingContext } from '../context/TradingContext';
import './PortfolioPanel.css';

const PortfolioPanel = () => {
  const { isDarkMode } = useTheme();
  const { balance, positions, addFunds, withdrawFunds, tradeHistory } = useTradingContext();
  const [fundAmount, setFundAmount] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Calculate total position value including PnL
  const totalPositionValue = positions
    .filter(p => p.status === 'open')
    .reduce((total, position) => {
      const currentValue = position.quantity * (position.currentPrice || position.entryPrice);
      return total + currentValue;
    }, 0);
  
  // Calculate total fees paid
  const totalFees = positions
    .reduce((total, position) => {
      return total + (position.fees || 0);
    }, 0) + 
    tradeHistory
      .filter(t => t.type === 'close')
      .reduce((total, trade) => total + (trade.fees || 0), 0);

  // Calculate realized PnL (from closed trades)
  const realizedPnL = tradeHistory
    .filter(t => t.type === 'close')
    .reduce((total, trade) => total + (trade.pnl || 0), 0);

  // Calculate unrealized PnL (from open positions)
  const unrealizedPnL = positions
    .filter(p => p.status === 'open')
    .reduce((total, position) => total + (position.pnl || 0), 0);

  // Calculate total margin used
  const totalMarginUsed = positions
    .filter(p => p.status === 'open')
    .reduce((total, position) => total + position.margin, 0);

  // Handle deposit
  const handleDeposit = () => {
    if (fundAmount && parseFloat(fundAmount) > 0) {
      addFunds(parseFloat(fundAmount));
      setFundAmount('');
    }
  };
  
  // Handle withdrawal
  const handleWithdraw = () => {
    if (fundAmount && parseFloat(fundAmount) > 0) {
      withdrawFunds(parseFloat(fundAmount));
      setFundAmount('');
    }
  };
  
  // Format datetime
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };
  
  return (
    <div className={`portfolio-panel ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="portfolio-header">
        <h2>Portfolio</h2>
        <div className="tab-selector">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Trade History
          </button>
        </div>
      </div>
      
      {activeTab === 'overview' ? (
        <>
          <div className="balance-section">
            <div className="balance-card">
              <h3>Total Balance</h3>
              <div className="balance-amount">
                ${(balance + unrealizedPnL).toFixed(2)}
              </div>
              <div className="balance-details">
                <div className="balance-detail">
                  <span>Available:</span>
                  <span>${balance.toFixed(2)}</span>
                </div>
                <div className="balance-detail">
                  <span>Margin Used:</span>
                  <span>${totalMarginUsed.toFixed(2)}</span>
                </div>
                <div className="balance-detail">
                  <span>Unrealized PnL:</span>
                  <span className={unrealizedPnL >= 0 ? 'profit' : 'loss'}>
                    {unrealizedPnL >= 0 ? '+' : '-'}${Math.abs(unrealizedPnL).toFixed(2)}
                  </span>
                </div>
                <div className="balance-detail">
                  <span>Realized PnL:</span>
                  <span className={realizedPnL >= 0 ? 'profit' : 'loss'}>
                    {realizedPnL >= 0 ? '+' : '-'}${Math.abs(realizedPnL).toFixed(2)}
                  </span>
                </div>
                <div className="balance-detail">
                  <span>Total Fees:</span>
                  <span className="fees">-${totalFees.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="fund-management">
            <h3>Manage Funds</h3>
            <div className="fund-form">
              <div className="fund-input-group">
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <div className="fund-buttons">
                  <button className="deposit-btn" onClick={handleDeposit}>Deposit</button>
                  <button className="withdraw-btn" onClick={handleWithdraw}>Withdraw</button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="account-summary">
            <h3>Account Summary</h3>
            <div className="summary-stats">
              <div className="stat-card">
                <div className="stat-title">Open Positions</div>
                <div className="stat-value">{positions.filter(p => p.status === 'open').length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Position Value</div>
                <div className="stat-value">${totalPositionValue.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Account Equity</div>
                <div className="stat-value">${(balance + unrealizedPnL - totalFees).toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Margin Used %</div>
                <div className="stat-value">
                  {((totalMarginUsed / balance) * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="history-section">
          {tradeHistory.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Entry Price</th>
                  <th>Close Price</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.slice().reverse().map((trade, index) => (
                  <tr key={`${trade.id}-${index}`}>
                    <td>{formatDateTime(trade.time)}</td>
                    <td>{trade.symbol}</td>
                    <td className={trade.direction === 'buy' ? 'buy' : 'sell'}>
                      {trade.type === 'open' ? 'Open ' : (trade.liquidated ? 'Liquidated ' : 'Close ')}
                      {trade.direction.toUpperCase()}
                    </td>
                    <td>{trade.quantity}</td>
                    <td>${parseFloat(trade.entryPrice || trade.price).toFixed(2)}</td>
                    <td>
                      {trade.type === 'close' 
                        ? `$${parseFloat(trade.closePrice || 0).toFixed(2)}` 
                        : '-'}
                    </td>
                    <td>
                      {trade.type === 'close' ? (
                        <span className={trade.pnl >= 0 ? 'profit' : 'loss'}>
                          {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-history">
              <p>No trade history found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioPanel;
