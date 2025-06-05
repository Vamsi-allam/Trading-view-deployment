import { createContext, useContext, useState, useEffect } from 'react';

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const [activeSection, setActiveSection] = useState('dashboard');

  // Change section without changing URL
  const navigateTo = (section) => {
    setActiveSection(section);
    window.history.replaceState(null, '', '/');
  };

  // Listen for custom navigation events
  useEffect(() => {
    const handleNavEvent = (event) => {
      setActiveSection(event.detail.section);
    };
    
    window.addEventListener('app-navigation', handleNavEvent);
    return () => window.removeEventListener('app-navigation', handleNavEvent);
  }, []);

  // Set initial section based on URL path (for page refreshes)
  useEffect(() => {
    // Get path from window.location instead of using useLocation hook
    const path = window.location.pathname.replace('/', '');
    if (path && ['dashboard', 'portfolio', 'alerts', 'analytics', 'settings'].includes(path)) {
      setActiveSection(path);
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ activeSection, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);
