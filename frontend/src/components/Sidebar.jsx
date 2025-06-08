import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaHome, FaBriefcase, FaBell, FaChartLine, FaCog, FaExchangeAlt } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  
  // Navigation items with sections instead of routes
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FaHome /> },
    { id: 'portfolio', label: 'Portfolio', icon: <FaBriefcase /> },
    // { id: 'alerts', label: 'Alerts', icon: <FaBell /> },
    { id: 'analytics', label: 'Analytics', icon: <FaChartLine /> },
    { id: 'settings', label: 'Settings', icon: <FaCog /> }
  ];

  // Handle navigation without changing URL - improved version
  const handleNavigation = (sectionId) => {
    setActiveSection(sectionId);
    
    // Use window.history instead of navigate for better control
    window.history.replaceState(null, '', '/');
    
    // Dispatch a custom event so other components can react to navigation
    const navEvent = new CustomEvent('app-navigation', { 
      detail: { section: sectionId } 
    });
    window.dispatchEvent(navEvent);
  };

  // Determine if section is active
  const isActive = (sectionId) => {
    return activeSection === sectionId;
  };

  // Set initial active section based on current path (for page refresh)
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('dashboard')) setActiveSection('dashboard');
    else if (path.includes('portfolio')) setActiveSection('portfolio');
    else if (path.includes('alerts')) setActiveSection('alerts');
    else if (path.includes('analytics')) setActiveSection('analytics');
    else if (path.includes('settings')) setActiveSection('settings');
  }, [location.pathname]);

  return (
    <div className={`sidebar ${isDarkMode ? 'dark' : 'light'} ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
      </div>
      
      <div className="sidebar-items">
        {navItems.map(item => (
          <div 
            key={item.id}
            className={`sidebar-item ${isActive(item.id) ? 'active' : ''}`}
            onClick={() => handleNavigation(item.id)}
          >
            {item.icon}
            {isOpen && <span>{item.label}</span>}
          </div>
        ))}
      </div>
      
      <div className="sidebar-footer">
        <div className="theme-toggle" onClick={toggleDarkMode}>
          {isOpen && (isDarkMode ? 'Light Mode' : 'Dark Mode')}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
