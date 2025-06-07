import { useNavigation } from '../context/NavigationContext';
import { useTheme } from '../context/ThemeContext'
import { useSnackbar } from '../context/SnackbarContext';
import './Header.css'
import { FaMoon, FaSun, FaUser, FaHome, FaChartLine, FaBell } from 'react-icons/fa'

const Header = () => {
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { showSuccess, showInfo } = useSnackbar();
  const { navigateTo } = useNavigation();
  
  const handleThemeToggle = () => {
    toggleDarkMode();
    showInfo(`Switched to ${isDarkMode ? 'light' : 'dark'} mode`);
  };
  
  return (
    <header className={`header ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">Trading View Clone</h1>
          
          
        </div>
        
        <div className="header-actions">
          <button 
            className="icon-button"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>
          
          <button onClick={() => navigateTo('portfolio')} className="btn-outline header-button">
            <FaUser /> Account
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header;
