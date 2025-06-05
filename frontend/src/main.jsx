import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertsProvider } from './context/AlertsContext'
import { ThemeProvider } from './context/ThemeContext'
import { SnackbarProvider } from './context/SnackbarContext'
import { IndicatorsProvider } from './context/IndicatorsContext'
import { TradingProvider } from './context/TradingContext'
import { NavigationProvider } from './context/NavigationContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <SnackbarProvider>
        <NavigationProvider>
          <AlertsProvider>
            <IndicatorsProvider>
              <TradingProvider>
                <App />
              </TradingProvider>
            </IndicatorsProvider>
          </AlertsProvider>
        </NavigationProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>,
)
