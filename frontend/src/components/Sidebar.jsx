import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaHome, FaBriefcase, FaBell, FaChartLine, FaCog, FaExchangeAlt } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  
  // Navigation items with routes - including Markets entry
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FaHome />, path: '/dashboard' },
    { id: 'portfolio', label: 'Portfolio', icon: <FaBriefcase />, path: '/portfolio' },
    { id: 'alerts', label: 'Alerts', icon: <FaBell />, path: '/alerts' },
    { id: 'analytics', label: 'Analytics', icon: <FaChartLine />, path: '/analytics' },
    { id: 'settings', label: 'Settings', icon: <FaCog />, path: '/settings' }
  ];

  // Check if current path is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className={`sidebar ${isDarkMode ? 'dark' : 'light'} ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
      </div>
      
      <div className="sidebar-items">
        {navItems.map(item => (
          <Link 
            key={item.id}
            to={item.path}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
          >
            {item.icon}
            {isOpen && <span>{item.label}</span>}
          </Link>
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
