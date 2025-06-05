import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext'
import { useSnackbar } from '../context/SnackbarContext';
import './Header.css'
import { FaMoon, FaSun, FaUser, FaHome, FaChartLine, FaBell } from 'react-icons/fa'

const Header = () => {
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { showSuccess, showInfo } = useSnackbar();
  
  const handleThemeToggle = () => {
    toggleDarkMode();
    showInfo(`Switched to ${isDarkMode ? 'light' : 'dark'} mode`);
  };
  
  return (
    <header className={`header ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">Trading View Clone</h1>
          
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link">
              <FaHome /> Dashboard
            </Link>
            <Link to="/analytics" className="nav-link">
              <FaChartLine /> Analytics
            </Link>
            <Link to="/alerts" className="nav-link">
              <FaBell /> Alerts
            </Link>
          </nav>
        </div>
        
        <div className="header-actions">
          <button 
            className="icon-button"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>
          
          <Link to="/portfolio" className="btn-outline header-button">
            <FaUser /> Account
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Header
