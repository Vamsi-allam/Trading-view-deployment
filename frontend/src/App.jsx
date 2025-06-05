import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './context/ThemeContext'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import TradingChart from './components/TradingChart'
import SimpleChart from './components/SimpleChart'
import AlertsPanel from './components/AlertsPanel'
import PositionsPanel from './components/PositionsPanel'
import PortfolioPanel from './components/PortfolioPanel'
import AnalyticsPanel from './components/AnalyticsPanel'
import SnackbarAlert from './components/SnackbarAlert'
import './App.css'

function App() {
  const { isDarkMode } = useTheme();
  const [useSimpleChart, setUseSimpleChart] = useState(false);
  // Add state for sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Toggle sidebar function
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // If TradingChart errors, fall back to SimpleChart
  useEffect(() => {
    const handleError = (event) => {
      if (event.message && event.message.includes('addCandlestickSeries')) {
        setUseSimpleChart(true);
      }
    }

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    }
  }, []);

  // Define page components for routes
  const Dashboard = () => (
    <>
      {useSimpleChart ? <SimpleChart /> : <TradingChart sidebarOpen={sidebarOpen} />}
      <PositionsPanel />
      <div className="dashboard-alerts-preview">
        <AlertsPanel compact={true} />
      </div>
    </>
  );

  const Settings = () => (
    <div className="content-panel">
      <h2>Settings</h2>
      <p>Settings panel coming soon. Here you'll be able to customize your trading preferences.</p>
    </div>
  );

  return (
    <Router>
      <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
        <Header />
        <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
          <Sidebar 
            isOpen={sidebarOpen} 
            toggleSidebar={toggleSidebar}
          />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/portfolio" element={<PortfolioPanel />} />
              <Route path="/alerts" element={<AlertsPanel compact={false} />} />
              <Route path="/analytics" element={<AnalyticsPanel />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
        <SnackbarAlert />
      </div>
    </Router>
  );
}

export default App;
