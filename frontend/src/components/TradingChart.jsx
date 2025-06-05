import { useState, useEffect, useRef, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { useTheme } from '../context/ThemeContext';
import { useAlerts } from '../context/AlertsContext';
import { useIndicators } from '../context/IndicatorsContext';
import { useTradingContext } from '../context/TradingContext'; // Add this import
import { fetchCandles, subscribeToPriceUpdates } from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import './TradingChart.css';
import IndicatorSelector from './IndicatorSelector';
import IndicatorManager from './IndicatorManager';
import OrderForm from './OrderForm'; // Add this import

const TradingChart = ({ sidebarOpen }) => {
  const chartContainerRef = useRef(null);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('5m');  
  const { isDarkMode } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPrice, setCurrentPrice] = useState(null);
  const [currentCandleData, setCurrentCandleData] = useState(null);
  const [hoverCandleData, setHoverCandleData] = useState(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const symbolRef = useRef(symbol);
  const candleDataRef = useRef([]);
  const { showError, showSuccess, showInfo } = useSnackbar();
  const { checkAlertsAgainstPrice } = useAlerts();
  const initialLoadRef = useRef(true);
  const lastPriceRef = useRef(null);
  const priceCheckIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Get indicators context BEFORE any references to activeIndicators
  const { activeIndicators, addIndicator, removeIndicator, updateIndicator } = useIndicators();
  
  // Add state for indicator selector dialog
  const [indicatorSelectorOpen, setIndicatorSelectorOpen] = useState(false);
  // Define indicatorSeriesRef here so it's accessible throughout the component
  const indicatorSeriesRef = useRef({});
  
  // Add state for order form
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderDirection, setOrderDirection] = useState('buy');
  
  // Get trading context
  const { updatePositionPnl, checkLimitOrders } = useTradingContext();
  
  // Handle buy/sell selection
  const handleDirectionChange = (direction) => {
    setOrderDirection(direction);
    setShowOrderForm(true);
  };
  
  const handleCloseOrderForm = () => {
    setShowOrderForm(false);
  };
  
  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Set isMountedRef on component mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Format time as HH:MM:SS
  const formattedTime = currentTime.toLocaleTimeString();
  
  // Format date as MMM DD, YYYY
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Set up alert checking interval separately
  useEffect(() => {
    // Reset the initial load flag after 5 seconds
    const initialLoadTimer = setTimeout(() => {
      initialLoadRef.current = false;
    }, 5000);
    
    // We'll still keep this for redundancy, but the AlertsContext will handle most checks
    const alertCheckInterval = setInterval(() => {
      if (!isMountedRef.current || initialLoadRef.current) return;
      
      const currentPrice = lastPriceRef.current;
      if (!currentPrice) return;
      
      try {
        // This will update the latest price but alerts for all symbols are now
        // checked automatically by the AlertsContext
        checkAlertsAgainstPrice?.(symbol, currentPrice);
      } catch (error) {
        console.error('Error checking alerts:', error);
      }
    }, 10000); // Reduced frequency to avoid redundant checks
    
    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(alertCheckInterval);
    };
  }, [symbol, checkAlertsAgainstPrice]);
  
  // Price updates subscription
  useEffect(() => {
    // Update the symbolRef when symbol changes
    symbolRef.current = symbol;
    
    const unsubscribe = subscribeToPriceUpdates(symbol, (price, time) => {
      if (!isMountedRef.current) return;
      if (symbolRef.current !== symbol) return;
      if (!candleSeriesRef.current) return;
      
      // Update the price display
      setCurrentPrice(price);
      lastPriceRef.current = price;
      
      // Update position PnL and check limit orders
      updatePositionPnl(symbol, price);
      checkLimitOrders(symbol, price);
      
      // Process candle updates
      try {
        // Get last candle from our stored ref
        const lastCandle = lastCandleRef.current;
        if (!lastCandle) return;
        
        // Update current candle data for display
        setCurrentCandleData({
          open: lastCandle.open,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price,
          change: parseFloat(((price - lastCandle.open) / lastCandle.open * 100).toFixed(2)),
          changePoints: parseFloat((price - lastCandle.open).toFixed(getDecimalPrecision(price)))
        });
        
        // Calculate interval in seconds based on timeframe
        let intervalSeconds = 60; // 1m
        if (timeframe === '5m') intervalSeconds = 300;
        if (timeframe === '15m') intervalSeconds = 900;
        if (timeframe === '1h') intervalSeconds = 3600;
        if (timeframe === '4h') intervalSeconds = 14400;
        if (timeframe === '1d') intervalSeconds = 86400;
        
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Calculate the correct candle time based on the current time and interval
        const currentCandleTime = Math.floor(currentTime / intervalSeconds) * intervalSeconds;
        
        // If the last candle is from a previous interval, create a new one
        if (lastCandle.time < convertToIndianTime(currentCandleTime)) {
          // Create a new candle with Indian time
          const newCandle = {
            time: convertToIndianTime(currentCandleTime),
            open: lastCandle.close,
            high: price,
            low: price,
            close: price,
            volume: 0
          };
          
          // Update our stored ref with the new candle
          lastCandleRef.current = newCandle;
          
          try {
            candleSeriesRef.current.update(newCandle);
          } catch (error) {
            console.error('Error updating candle:', error);
          }
        } else {
          // Update the current candle
          const updatedCandle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
            close: price
          };
          
          // Update our stored ref
          lastCandleRef.current = updatedCandle;
          
          try {
            // Add visual feedback for candle updates
            candleSeriesRef.current.update(updatedCandle);
          } catch (error) {
            console.error('Error updating existing candle:', error);
          }
        }
        
        // Update current candle data for display
        if (lastCandle) {
          setCurrentCandleData({
            open: lastCandle.open,
            high: lastCandle.high, 
            low: lastCandle.low,
            close: price,  // Use current price as close
            change: parseFloat(((price - lastCandle.open) / lastCandle.open * 100).toFixed(2)),
            changePoints: parseFloat((price - lastCandle.open).toFixed(getDecimalPrecision(price)))
          });
        }
      } catch (error) {
        console.error('Error handling candle update:', error);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [symbol, timeframe, updatePositionPnl, checkLimitOrders]);

  // Main chart initialization effect
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Display loading message
    chartContainerRef.current.innerHTML = `
      <div class="chart-loading">
        <p>Loading chart...</p>
      </div>
    `;
    
    // Use a longer delay to ensure DOM is ready before chart initialization
    const initTimeout = setTimeout(async () => {
      const loadChart = async () => {
        try {
          // First, check if lightweight-charts is installed
          let LightweightCharts;
          try {
            // Directly import the installed package
            LightweightCharts = await import('lightweight-charts');
          } catch (e) {
            // Show error message using snackbar instead of alert
            showError('Failed to load chart library. Please install lightweight-charts.');
            
            // If not installed, show installation instructions
            chartContainerRef.current.innerHTML = `
              <div class="chart-error">
                <p>The lightweight-charts library is not installed.</p>
                <p>Please install it using:</p>
                <pre>npm install lightweight-charts</pre>
              </div>
            `;
            return;
          }
          
          // Clear previous chart
          if (!chartContainerRef.current) return; // Additional check before clearing
          chartContainerRef.current.innerHTML = '';
          
          // Create a chart container div with explicit dimensions
          const chartDiv = document.createElement('div');
          chartDiv.style.width = '100%';
          chartDiv.style.height = '500px'; // Explicit height
          chartDiv.style.position = 'relative';
          
          // Make sure chartContainerRef.current still exists before appending
          if (!chartContainerRef.current) return;
          chartContainerRef.current.appendChild(chartDiv);
          
          // Give browser time to render the div before creating the chart
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Double check that the chartDiv is still in the document
          if (!chartDiv.isConnected || !document.contains(chartDiv)) {
            console.log("Chart div is no longer in document, aborting chart creation");
            return;
          }
          
          // Get the createChart function
          let createChartFn;
          if (LightweightCharts.default && typeof LightweightCharts.default.createChart === 'function') {
            createChartFn = LightweightCharts.default.createChart;
          } else if (typeof LightweightCharts.createChart === 'function') {
            createChartFn = LightweightCharts.createChart;
          } else if (LightweightCharts.default && typeof LightweightCharts.default === 'function') {
            createChartFn = LightweightCharts.default;
          }
          
          if (!createChartFn) {
            throw new Error('createChart function not found');
          }
          
          // Add a function to determine price precision based on symbol
          const getPriceFormatForSymbol = (symbol) => {
            if (symbol === 'DOGEUSDT') {
              return {
                type: 'price',
                precision: 5,
                minMove: 0.00001,
              };
            } else if (symbol === 'BTCUSDT') {
              return {
                type: 'price',
                precision: 1,
                minMove: 0.1,
              };
            } else if (symbol === 'XRPUSDT') {
              return {
                type: 'price',
                precision: 4,
                minMove: 0.0001,
              };
            } else if (symbol === 'SOLUSDT' || symbol === 'ETHUSDT') {
              return {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              };
            } else if (symbol.includes('USDT')) {
              // Dynamically determine precision based on typical price range
              // Fetch the current price if available
              const price = currentPrice || 10; // Default to 10 if no price available
              
              if (price < 0.1) return { type: 'price', precision: 6, minMove: 0.000001 };
              if (price < 1) return { type: 'price', precision: 5, minMove: 0.00001 };
              if (price < 10) return { type: 'price', precision: 4, minMove: 0.0001 };
              if (price < 100) return { type: 'price', precision: 3, minMove: 0.001 };
              if (price < 1000) return { type: 'price', precision: 2, minMove: 0.01 };
              return { type: 'price', precision: 1, minMove: 0.1 };
            } else {
              return {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              };
            }
          };
          
          // Set up proper price formatting for both the right price scale and candlestick series
          const priceFormat = getPriceFormatForSymbol(symbol);
          
          // Create chart with explicit dimensions and proper price formatting
          const chart = createChartFn(chartDiv, {
            width: chartDiv.clientWidth || 800,
            height: 500,
            layout: {
              background: { color: isDarkMode ? '#000000' : '#ffffff' }, // Changed from #131722 to #000000
              textColor: isDarkMode ? '#D9D9D9' : '#191919',
            },
            grid: {
              vertLines: { color: isDarkMode ? '#232323' : '#E6E6E6' },
              horzLines: { color: isDarkMode ? '#232323' : '#E6E6E6' },
            },
            timeScale: {
              borderColor: isDarkMode ? '#2B2B43' : '#E6E6E6',
              timeVisible: true,
              secondsVisible: false,
            },
            crosshair: {
              mode: LightweightCharts.CrosshairMode?.Normal || 0,
            },
            rightPriceScale: {
              borderColor: isDarkMode ? '#2B2B43' : '#E6E6E6',
              // Add proper formatting for the price scale
              format: priceFormat
            },
          });
          
          chartInstanceRef.current = chart;
          
          // Debug output to inspect chart object
          console.log('Chart methods:', Object.keys(chart));
          
          // Try all possible ways to create a candlestick series
          let candleSeries;
          
          if (typeof chart.addCandlestickSeries === 'function') {
            candleSeries = chart.addCandlestickSeries({
              upColor: '#26a69a', 
              downColor: '#ef5350',
              borderVisible: false,
              wickUpColor: '#26a69a', 
              wickDownColor: '#ef5350',
              priceFormat: priceFormat
            });
          } else if (chart.series && typeof chart.series.candlestick === 'function') {
            candleSeries = chart.series.candlestick({
              upColor: '#26a69a', 
              downColor: '#ef5350',
              borderVisible: false,
              wickUpColor: '#26a69a', 
              wickDownColor: '#ef5350'
            });
          } else {
            throw new Error('Could not find method to create candlestick series');
          }
          
          candleSeriesRef.current = candleSeries;
          
          // Debug and fix the hover functionality
          console.log("Setting up crosshair hover", { candleSeries });

          // Set up custom crosshair move handler with multiple fallbacks
          chart.subscribeCrosshairMove((param) => {
            // If cursor leaves the chart or no param, clear hover data
            if (!param) {
              setHoverCandleData(null);
              return;
            }

            // Extract needed values with optional chaining
            const time = param.time;
            
            // If no time value, we're not over a candle
            if (!time) {
              setHoverCandleData(null);
              return;
            }
            
            // Try multiple approaches to get the candle data
            let candleData = null;
            
            // Direct approach #1: Try to get value from seriesPrices map (newer versions)
            if (param.seriesPrices && typeof param.seriesPrices.get === 'function') {
              try {
                candleData = param.seriesPrices.get(candleSeries);
                //console.log("Got data from seriesPrices.get", candleData);
              } catch (e) {}
            }
            
            // Direct approach #2: Try to access as property (some versions)
            if (!candleData && param.seriesPrices && param.seriesPrices[candleSeries]) {
              candleData = param.seriesPrices[candleSeries];
              //console.log("Got data from seriesPrices[candleSeries]", candleData);
            }
            
            // Fallback #1: Try to use seriesData (older versions)
            if (!candleData && param.seriesData && typeof param.seriesData.get === 'function') {
              try {
                candleData = param.seriesData.get(candleSeries);
                //console.log("Got data from seriesData.get", candleData);
              } catch (e) {}
            }
            
            // Fallback #2: Try to use internal ID
            if (!candleData && candleSeries._internal_id && param.seriesData) {
              try {
                candleData = param.seriesData.get(candleSeries._internal_id);
                //console.log("Got data from internal ID", candleData);
              } catch (e) {}
            }
            
            // Fallback #3: Try to search existing data
            if (!candleData && time) {
              // Try to find the candle in our data
              try {
                // Request candle at specific time from series if possible
                if (typeof candleSeries.dataByIndex === 'function') {
                  const dataIndex = candleSeries.barsInLogicalRange(time, time);
                  if (dataIndex) {
                    candleData = candleSeries.dataByIndex(dataIndex.from);
                  }
                }
              } catch (e) {}
            }
            
            // If we found candle data, use it
            if (candleData && typeof candleData === 'object') {
              try {
                // If it has OHLC properties, it's a candle
                if (candleData.open !== undefined && candleData.close !== undefined) {
                  const change = ((candleData.close - candleData.open) / candleData.open * 100).toFixed(2);
                  const pointPrecision = getDecimalPrecision(candleData.close);
                  const changePoints = (candleData.close - candleData.open).toFixed(pointPrecision);
                  
                  // Remove the time property to keep the overlay consistent
                  setHoverCandleData({
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    change: change,
                    changePoints: parseFloat(changePoints)
                  });
                  return;
                }
              } catch (e) {
                console.error("Error formatting candle data:", e);
              }
            }
            
            // No valid data found
            setHoverCandleData(null);
          });
          
          // Handle resize
          const handleResize = () => {
            if (chart) {
              chart.applyOptions({ 
                width: chartContainerRef.current.clientWidth 
              });
            }
          };
          
          window.addEventListener('resize', handleResize);
          
          // Load data
          try {
            const data = await fetchCandles(symbol, timeframe);
            
            // Ensure data is in the correct format AND convert to Indian time
            const formattedData = data.map(candle => ({
              // Convert UTC timestamp to Indian time (IST)
              time: convertToIndianTime(typeof candle.time === 'number' ? candle.time : Math.floor(new Date(candle.time).getTime() / 1000)),
              open: Number(candle.open),
              high: Number(candle.high),
              low: Number(candle.low),
              close: Number(candle.close),
              volume: Number(candle.volume || 0)
            }));
            
            // Store the formatted data in the ref for indicators to use
            candleDataRef.current = formattedData;
            
            if (formattedData.length > 0) {
              candleSeries.setData(formattedData);
              
              // Set current price from last candle
              const lastCandle = formattedData[formattedData.length - 1];
              setCurrentPrice(lastCandle.close);
              lastPriceRef.current = lastCandle.close;
              
              // Store the last candle in the ref for future use
              lastCandleRef.current = lastCandle;
              
              // Get the time scale
              const timeScale = chart.timeScale();
              
              // First fit all content to ensure proper layout
              timeScale.fitContent();
              
              // Then zoom in to show only the most recent candles
              setTimeout(() => {
                if (formattedData.length > 50) {
                  const candlesToShow = sidebarOpen ? 210 : 250;
                  const fromIndex = Math.max(0, formattedData.length - candlesToShow);
                  const toIndex = formattedData.length - 1;
                  
                  // Create a visible range for the candles
                  const visibleRange = {
                    from: formattedData[fromIndex].time,
                    to: formattedData[toIndex].time
                  };
                  
                  // Set the visible range
                  timeScale.setVisibleRange(visibleRange);
                }
                
                // Reapply indicators after chart is fully set up with data
                if (activeIndicators.length > 0) {
                  console.log(`Reapplying ${activeIndicators.length} indicators after symbol change to ${symbol}`);
                  // Need a small delay to ensure chart is ready
                  setTimeout(() => {
                    activeIndicators.forEach(indicator => {
                      try {
                        addIndicatorToChart(indicator);
                      } catch (error) {
                        console.error(`Error adding indicator ${indicator.name} after symbol change:`, error);
                      }
                    });
                  }, 100);
                }
              }, 100); // Short delay to ensure chart is fully rendered
              
              // Show success message when chart loads
              showSuccess(`${symbol} chart data loaded successfully`);
            }
          } catch (error) {
            console.error('Failed to load chart data:', error);
            showError('Failed to load chart data. Please try again later.');
            chartContainerRef.current.innerHTML = `
              <div class="chart-error">
                <p>Error loading chart data. Please try again later.</p>
              </div>
            `;
          }
          
          // Return cleanup function
          return () => {
            window.removeEventListener('resize', handleResize);
            if (chart) {
              chart.remove();
            }
          };
        } catch (error) {
          console.error('Failed to load chart library:', error);
          showError(`Failed to initialize chart: ${error.message}`);
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = `
              <div class="chart-error">
                <p>Error initializing chart: ${error.message}</p>
                <p>Please try reinstalling the library:</p>
                <pre>npm install lightweight-charts@3.8.0</pre>
              </div>
            `;
          }
        }
      };
      
      // Load the chart
      loadChart();
    }, 300); // Longer delay to ensure DOM is ready
    
    return () => {
      clearTimeout(initTimeout);
      // ...existing code...
    };
  }, [symbol, timeframe, isDarkMode, showError, showSuccess]);
  
  // Separate effect to handle sidebar toggling - make sure chart exists before modifying
  useEffect(() => {
    // Check if chart exists
    if (chartInstanceRef.current && lastCandleRef.current) {
      // Force a resize after a short delay to allow sidebar transition to complete
      const resizeTimeout = setTimeout(() => {
        try {
          if (chartInstanceRef.current && chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
            // Update chart width based on new container size
            chartInstanceRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth
            });
            
            // Instead of fitContent(), we'll set visible range based on sidebar state
            // Get the most recent candle time from our ref
            const lastCandleTime = lastCandleRef.current.time;
            
            // Number of candles to show based on sidebar state
            const candlesToShow = sidebarOpen ? 210 : 250;
            
            // Calculate time range for candles based on sidebar state
            let timeRangeInSeconds;
            if (timeframe === '1m') timeRangeInSeconds = candlesToShow * 60;
            else if (timeframe === '5m') timeRangeInSeconds = candlesToShow * 5 * 60;
            else if (timeframe === '15m') timeRangeInSeconds = candlesToShow * 15 * 60;
            else if (timeframe === '1h') timeRangeInSeconds = candlesToShow * 60 * 60;
            else if (timeframe === '4h') timeRangeInSeconds = candlesToShow * 4 * 60 * 60;
            else if (timeframe === '1d') timeRangeInSeconds = candlesToShow * 24 * 60 * 60;
            else timeRangeInSeconds = candlesToShow * 5 * 60; // Default to 5m
            
            // Calculate start time (Indian time)
            const fromTime = lastCandleTime - timeRangeInSeconds;
            
            // Create visible range for the candles
            const visibleRange = {
              from: fromTime,
              to: lastCandleTime
            };
            
            // Set the visible range to show the appropriate number of candles
            chartInstanceRef.current.timeScale().setVisibleRange(visibleRange);
          }
        } catch (error) {
          console.error("Error resizing chart:", error);
        }
      }, 400);
      
      return () => clearTimeout(resizeTimeout);
    }
  }, [sidebarOpen, timeframe]);

  // Handle symbol change
  const handleSymbolChange = (e) => {
    setCurrentPrice(null);
    const newSymbol = e.target.value;
    showInfo(`Changing to ${newSymbol.replace('USDT', '/USDT')}`);
    setSymbol(newSymbol);
    symbolRef.current = newSymbol;
    
    // Clear indicators when changing symbols - they'll be re-added after data loads
    if (chartInstanceRef.current) {
      // Clear existing indicators first
      Object.keys(indicatorSeriesRef.current).forEach(instanceId => {
        try {
          const series = indicatorSeriesRef.current[instanceId];
          if (series) {
            if (typeof series.remove === 'function') {
              series.remove();
            } else if (series.main || series.upper || series.macdLine) {
              // Complex indicator with multiple components
              Object.values(series).forEach(s => {
                if (s && typeof s !== 'function' && chartInstanceRef.current) {
                  try {
                    chartInstanceRef.current.removeSeries(s);
                  } catch (err) {}
                }
              });
            } else {
              chartInstanceRef.current.removeSeries(series);
            }
          }
        } catch (error) {
          console.error(`Error removing indicator ${instanceId}:`, error);
        }
      });
      
      // Reset the series references
      indicatorSeriesRef.current = {};
    }
  };

  // Add helper function to determine decimal precision based on price
  const getDecimalPrecision = (price) => {
    if (price < 0.0001) return 8;
    if (price < 0.01) return 6;
    if (price < 1) return 5;
    if (price < 10) return 4;  // XRP range (increased from 3 to 4 decimals)
    if (price < 100) return 3;
    if (price < 1000) return 2;
    return 2;
  };
  
  // Add a function to convert UTC timestamps to Indian time (IST)
  const convertToIndianTime = (utcTimestamp) => {
    // Add 5 hours and 30 minutes (5.5 hours) to convert UTC to IST
    // 5.5 hours = 19800 seconds
    return utcTimestamp + 19800;
  };
  
  // Add state for context menu
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  
  // Handle context menu (right-click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };
  
  // Handle click outside to close context menu
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);
  
  // Reset chart to default view
  const handleResetChart = () => {
    if (chartInstanceRef.current && lastCandleRef.current) {
      const timeScale = chartInstanceRef.current.timeScale();
      
      // Get the most recent candle from our ref
      const lastCandle = lastCandleRef.current;
      
      // Number of candles to show based on sidebar state
      const candlesToShow = sidebarOpen ? 210 : 250;
      
      // Calculate time range for approximately the right number of candles
      let timeRangeInSeconds;
      if (timeframe === '1m') timeRangeInSeconds = candlesToShow * 60;
      else if (timeframe === '5m') timeRangeInSeconds = candlesToShow * 5 * 60;
      else if (timeframe === '15m') timeRangeInSeconds = candlesToShow * 15 * 60;
      else if (timeframe === '1h') timeRangeInSeconds = candlesToShow * 60 * 60;
      else if (timeframe === '4h') timeRangeInSeconds = candlesToShow * 4 * 60 * 60;
      else if (timeframe === '1d') timeRangeInSeconds = candlesToShow * 24 * 60 * 60;
      else timeRangeInSeconds = candlesToShow * 5 * 60; // Default to 5m
      
      // Calculate start time (Indian time)
      const fromTime = lastCandle.time - timeRangeInSeconds;
      
      // Create visible range for the candles
      const visibleRange = {
        from: fromTime,
        to: lastCandle.time
      };
      
      // Set the visible range to show the appropriate number of candles
      timeScale.setVisibleRange(visibleRange);
      
      showInfo(`Chart view reset`);
      setContextMenu({ ...contextMenu, visible: false });
    }
  };
  
  // Open indicator selector
  const handleOpenIndicatorSelector = () => {
    // Add a small delay to ensure button blur happens before dialog opens
    setTimeout(() => {
      setIndicatorSelectorOpen(true);
    }, 10);
  };
  
  // Close indicator selector
  const handleCloseIndicatorSelector = () => {
    setIndicatorSelectorOpen(false);
  };
  
  // Update to use context functions
  const handleAddIndicator = (indicator) => {
    // Log the indicator being added
    console.log(`Adding indicator: ${indicator.name}`, indicator);
    
    // Add to indicators context
    const newIndicator = addIndicator(indicator);
    
    // Add to chart if chart exists
    if (chartInstanceRef.current && candleSeriesRef.current) {
      try {
        console.log("Candle data length:", candleDataRef.current.length);
        if (!candleDataRef.current || candleDataRef.current.length === 0) {
          console.error("No candle data available for indicators");
          showError(`Failed to add ${indicator.name}: No candle data available`);
          return;
        }

        addIndicatorToChart(newIndicator);
        showSuccess(`Added ${indicator.name} to chart`);
      } catch (error) {
        console.error('Error adding indicator to chart:', error);
        showError(`Failed to add ${indicator.name} to chart: ${error.message}`);
      }
    } else {
      console.error('Chart not initialized');
      showError(`Failed to add indicator: Chart not initialized`);
    }
  };
  
  // Update removeIndicator to use context with better error handling
  const handleRemoveIndicator = (instanceId) => {
    // Find the indicator to remove
    const indicatorToRemove = activeIndicators.find(ind => ind.instanceId === instanceId);
    
    if (indicatorToRemove) {
      // Remove from context
      removeIndicator(instanceId);
      
      // Remove from chart
      if (chartInstanceRef.current) {
        try {
          const series = indicatorSeriesRef.current[instanceId];
          
          // Only try to remove if the series exists
          if (series) {
            if (typeof series.remove === 'function') {
              // Use custom remove function if available
              series.remove();
            } else if (series.main || series.upper || series.macdLine) {
              // Handle complex indicator objects with multiple series
              if (series.main) chartInstanceRef.current.removeSeries(series.main);
              if (series.upper) chartInstanceRef.current.removeSeries(series.upper);
              if (series.middle) chartInstanceRef.current.removeSeries(series.middle);
              if (series.lower) chartInstanceRef.current.removeSeries(series.lower);
              if (series.overSoldLine) chartInstanceRef.current.removeSeries(series.overSoldLine);
              if (series.overBoughtLine) chartInstanceRef.current.removeSeries(series.overBoughtLine);
              if (series.macdLine) chartInstanceRef.current.removeSeries(series.macdLine);
              if (series.signalLine) chartInstanceRef.current.removeSeries(series.signalLine);
              if (series.histogram) chartInstanceRef.current.removeSeries(series.histogram);
            } else {
              // For simple series
              chartInstanceRef.current.removeSeries(series);
            }
            
            // Remove from the ref object
            delete indicatorSeriesRef.current[instanceId];
            showInfo(`Removed ${indicatorToRemove.name} from chart`);
          } else {
            console.log(`No series found for indicator ${instanceId}, just removing from state`);
            showInfo(`Removed ${indicatorToRemove.name}`);
          }
        } catch (error) {
          console.error('Error removing indicator from chart:', error);
          showError(`Failed to remove indicator: ${error.message}`);
          
          // Still remove from our ref object even if removal failed
          delete indicatorSeriesRef.current[instanceId];
        }
      }
    }
  };
  
  // Update to use context
  const handleUpdateIndicator = (updatedIndicator) => {
    try {
      // Update in context
      updateIndicator(updatedIndicator);
      
      // Update on chart
      if (chartInstanceRef.current) {
        const existingSeries = indicatorSeriesRef.current[updatedIndicator.instanceId];
        
        if (existingSeries) {
          // Handle both simple series and complex series objects with remove method
          try {
            if (typeof existingSeries.remove === 'function') {
              existingSeries.remove();
            } else {
              chartInstanceRef.current.removeSeries(existingSeries);
            }
            
            // Add the updated indicator
            addIndicatorToChart(updatedIndicator);
            showSuccess(`Updated ${updatedIndicator.name} settings`);
          } catch (error) {
            console.error('Error updating indicator series:', error);
            showError(`Failed to update indicator: ${error.message}`);
          }
        } else {
          // If no existing series found (shouldn't happen), just add it
          addIndicatorToChart(updatedIndicator);
          showSuccess(`Added ${updatedIndicator.name} to chart`);
        }
      }
    } catch (error) {
      console.error('Error updating indicator:', error);
      showError(`Failed to update indicator: ${error.message}`);
    }
  };
  
  // Add effect to add all active indicators when symbol changes or component mounts
  useEffect(() => {
    // Don't try to add indicators until we have chart and data
    if (!chartInstanceRef.current || !candleSeriesRef.current || !candleDataRef.current || candleDataRef.current.length === 0) {
      return;
    }

    // Skip this effect when symbols are changing - we'll handle that in the chart init effect
    if (symbolRef.current !== symbol) {
      return;
    }

    console.log(`Indicator list changed: Adding ${activeIndicators.length} indicators to ${symbol} chart`);
    
    // Clear existing indicators from the chart with better error handling
    Object.keys(indicatorSeriesRef.current).forEach(instanceId => {
      try {
        const series = indicatorSeriesRef.current[instanceId];
        if (!series) {
          console.log(`No series found for indicator ${instanceId}, skipping removal`);
          return; // Skip this iteration if series is undefined
        }
        
        if (chartInstanceRef.current) {
          // Handle indicator series that have a custom remove function
          if (typeof series.remove === 'function') {
            series.remove();
          } else if (series.main || series.upper || series.macdLine) {
            // Handle complex indicator objects with multiple series
            if (series.main) chartInstanceRef.current.removeSeries(series.main);
            if (series.upper) chartInstanceRef.current.removeSeries(series.upper);
            if (series.middle) chartInstanceRef.current.removeSeries(series.middle);
            if (series.lower) chartInstanceRef.current.removeSeries(series.lower);
            if (series.overSoldLine) chartInstanceRef.current.removeSeries(series.overSoldLine);
            if (series.overBoughtLine) chartInstanceRef.current.removeSeries(series.overBoughtLine);
            if (series.macdLine) chartInstanceRef.current.removeSeries(series.macdLine);
            if (series.signalLine) chartInstanceRef.current.removeSeries(series.signalLine);
            if (series.histogram) chartInstanceRef.current.removeSeries(series.histogram);
          } else {
            // For simple series
            chartInstanceRef.current.removeSeries(series);
          }
        }
      } catch (error) {
        console.error(`Error removing indicator ${instanceId}:`, error);
        // Continue with other indicators even if this one failed
      }
    });
    
    // Reset the series references
    indicatorSeriesRef.current = {};
    
    // Add all active indicators
    activeIndicators.forEach(indicator => {
      try {
        addIndicatorToChart(indicator);
      } catch (error) {
        console.error(`Error adding indicator ${indicator.name}:`, error);
      }
    });
  }, [activeIndicators]); // Only run when activeIndicators changes, not on symbol changes

  // Function to add an indicator to the chart
  const addIndicatorToChart = (indicator) => {
    // Make sure we're using the ref defined at the component level
    if (!chartInstanceRef.current || !candleSeriesRef.current) {
      console.error("Chart or candle series not initialized");
      return;
    }
    
    const chart = chartInstanceRef.current;
    // Use the stored candle data instead of trying to retrieve it from the series
    const candles = candleDataRef.current;
    
    console.log(`Adding ${indicator.name} to chart with ${candles.length} candles`);
    
    if (!candles || candles.length === 0) {
      showError("No candle data available for indicators");
      return;
    }
    
    try {
      switch (indicator.id) {
        case 'sma':
        case 'ema':
        case 'wma': {
          // Create a moving average series
          const maType = indicator.id.toUpperCase();
          const period = indicator.params.period;
          const source = indicator.params.source || 'close'; // Default to close if not specified
          
          console.log(`Calculating ${maType} with period ${period} using ${source} prices`);
          
          // Calculate MA values
          const maData = calculateMovingAverage(candles, period, indicator.id, source);
          console.log(`Calculated ${maData.length} ${maType} points`);
          
          // Use fixed colors based on period instead of random colors
          // This ensures consistent colors even when changing symbols
          const getFixedColor = (type, period) => {
            // Color scheme based on period ranges
            if (period <= 10) return '#00FF00'; // Red for short periods
            if (period <= 25) return '#FF0000'; // Red for short periods
            if (period <= 50) return '#FFA500'; // Orange for longer periods
            if (period <= 100) return '#9C27B0'; // Purple for very long periods
            return '#2196F3'; // Blue for extra long periods
          };
          
          // Create the line series with fixed color
          const lineSeries = chart.addLineSeries({
            color: getFixedColor(indicator.id, period),
            lineWidth: 2,
            priceLineVisible: false,
            //title: `${maType}(${period})`,
          });
          
          // Set the data
          lineSeries.setData(maData);
          console.log(`Added ${maType} indicator to chart`, lineSeries);
          
          // Store the series reference
          indicatorSeriesRef.current[indicator.instanceId] = lineSeries;
          break;
        }
        
        // Add more indicators as needed
        
        default:
          console.warn(`Indicator ${indicator.id} not implemented yet`);
          break;
      }
    } catch (error) {
      console.error(`Error adding ${indicator.id} indicator:`, error);
      showError(`Failed to add indicator: ${error.message}`);
    }
  };
  
  // Update the calculateMovingAverage function to properly handle EMA calculation
  const calculateMovingAverage = (candles, period, type = 'sma', source = 'close') => {
    const result = [];
    console.log(`Calculating ${type.toUpperCase()} with ${period} period on ${source} prices`);
    
    if (candles.length < period) {
      console.warn(`Not enough candles (${candles.length}) for period ${period}`);
      return result;
    }
    
    // For EMA, calculate the first value as SMA
    if (type === 'ema') {
      // Calculate initial SMA
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += candles[i][source];
      }
      const initialSMA = sum / period;
      
      // Add the first point (SMA)
      result.push({
        time: candles[period - 1].time,
        value: initialSMA
      });
      
      // Calculate remaining EMAs
      const multiplier = 2 / (period + 1);
      
      for (let i = period; i < candles.length; i++) {
        const currentPrice = candles[i][source];
        const previousEMA = result[result.length - 1].value;
        const currentEMA = (currentPrice - previousEMA) * multiplier + previousEMA;
        
        result.push({
          time: candles[i].time,
          value: currentEMA
        });
      }
      
      console.log(`Generated ${result.length} EMA values`);
      return result;
    }
    
    // Original code for SMA and WMA calculations
    
  };
  
  // Similarly update calculateBollingerBands to use the source parameter
  
  
  
  // Calculate MACD
  
  // Helper function to generate random colors for indicators
  
  // Modify the return JSX to include indicator selector and manager
  return (
    <div className={`chart-container ${isDarkMode ? 'dark' : 'light'} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <div className="chart-header">
        <div className="chart-controls">
          <select 
            value={symbol} 
            onChange={handleSymbolChange}
            className="chart-select"
          >
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
            <option value="BNBUSDT">BNB/USDT</option>
            <option value="XRPUSDT">XRP/USDT</option>
            <option value="DOGEUSDT">DOGE/USDT</option>
            <option value="AVAXUSDT">AVAX/USDT</option>
            <option value="BCHUSDT">BCH/USDT</option>
            <option value="LTCUSDT">LTC/USDT</option>
            <option value="ADAUSDT">ADA/USDT</option>
            <option value="DOTUSDT">DOT/USDT</option>

          </select>
          
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="chart-select"
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1D</option>
          </select>
          
          <button 
            className="btn-primary"
            onClick={handleOpenIndicatorSelector}
            onFocus={(e) => e.currentTarget.blur()}
          >
            Add Indicator
          </button>
        </div>
        
        <div className="chart-info">
          <div className="price-display">
            {currentPrice ? (
              <span className="current-price">
                $
                {(() => {
                  // For cryptocurrencies with small values like DOGE
                  if (currentPrice < 0.1) {
                    // Force 7 decimal places for very small values
                    return parseFloat(currentPrice).toFixed(7);
                  }
                  else if (currentPrice < 1) {
                    // Force 5 decimal places for small values
                    return parseFloat(currentPrice).toFixed(5);
                  }
                  // For medium-low values like XRP (1-10)
                  else if (currentPrice < 10) {
                    return parseFloat(currentPrice).toFixed(4);
                  }
                  else if(currentPrice < 100) {
                    return parseFloat(currentPrice).toFixed(3);
                  }
                  // For medium values (10-1000)
                  else if (currentPrice < 1000) {
                    return parseFloat(currentPrice).toFixed(2);
                  } 
                  // For large values like BTC
                  else {
                    return parseFloat(currentPrice).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    });
                  }
                })()}
              </span>
            ) : 'Loading...'}
          </div>
          <div className="time-display">
            <span className="current-date">{formattedDate}</span>
            <span className="current-time">{formattedTime}</span>
          </div>
          
          {/* Add a Buy/Sell toggle for the side panel direction */}
          <div className="direction-toggle">
            <button 
              className={`direction-btn buy ${orderDirection === 'buy' ? 'active' : ''}`}
              onClick={() => handleDirectionChange('buy')}
            >
              Buy
            </button>
            <button 
              className={`direction-btn sell ${orderDirection === 'sell' ? 'active' : ''}`}
              onClick={() => handleDirectionChange('sell')}
            >
              Sell
            </button>
          </div>
        </div>
      </div>
      
      <div className="chart-wrapper">
        {/* Show current candle data when not hovering */}
        {currentCandleData && !hoverCandleData && (
          <div className="candle-data-overlay">
            <div className={`candle-data-item ${currentCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-label">O:</span>
              <span className="candle-data-value">{parseFloat(currentCandleData.open).toFixed(getDecimalPrecision(currentCandleData.open))}</span>
            </div>
            <div className="candle-data-item positive">
              <span className="candle-data-label">H:</span>
              <span className="candle-data-value">{parseFloat(currentCandleData.high).toFixed(getDecimalPrecision(currentCandleData.high))}</span>
            </div>
            <div className="candle-data-item negative">
              <span className="candle-data-label">L:</span>
              <span className="candle-data-value">{parseFloat(currentCandleData.low).toFixed(getDecimalPrecision(currentCandleData.low))}</span>
            </div>
            <div className={`candle-data-item ${currentCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-label">C:</span>
              <span className="candle-data-value">{parseFloat(currentCandleData.close).toFixed(getDecimalPrecision(currentCandleData.close))}</span>
            </div>
            <div className={`candle-data-item change ${currentCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-value">
                {currentCandleData.changePoints >= 0 ? '+' : ''}
                {currentCandleData.changePoints.toFixed(getDecimalPrecision(currentCandleData.close))}
              </span>
              <span className="candle-data-value">({currentCandleData.change >= 0 ? '+' : ''}{currentCandleData.change}%)</span>
            </div>
          </div>
        )}
        
        {/* Show hover candle data when hovering */}
        {hoverCandleData && (
          <div className="candle-data-overlay hover">
            {/* Removed time div to keep consistent with non-hover display */}
            <div className={`candle-data-item ${hoverCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-label">O:</span>
              <span className="candle-data-value">{parseFloat(hoverCandleData.open).toFixed(getDecimalPrecision(hoverCandleData.open))}</span>
            </div>
            <div className="candle-data-item positive">
              <span className="candle-data-label">H:</span>
              <span className="candle-data-value">{parseFloat(hoverCandleData.high).toFixed(getDecimalPrecision(hoverCandleData.high))}</span>
            </div>
            <div className="candle-data-item negative">
              <span className="candle-data-label">L:</span>
              <span className="candle-data-value">{parseFloat(hoverCandleData.low).toFixed(getDecimalPrecision(hoverCandleData.low))}</span>
            </div>
            <div className={`candle-data-item ${hoverCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-label">C:</span>
              <span className="candle-data-value">{parseFloat(hoverCandleData.close).toFixed(getDecimalPrecision(hoverCandleData.close))}</span>
            </div>
            <div className={`candle-data-item change ${hoverCandleData.change >= 0 ? 'positive' : 'negative'}`}>
              <span className="candle-data-value">
                {hoverCandleData.changePoints >= 0 ? '+' : ''}
                {hoverCandleData.changePoints.toFixed(getDecimalPrecision(hoverCandleData.close))}
              </span>
              <span className="candle-data-value">({hoverCandleData.change >= 0 ? '+' : ''}{hoverCandleData.change}%)</span>
            </div>
          </div>
        )}
        
        <div 
          ref={chartContainerRef} 
          className="chart-area"
          onContextMenu={handleContextMenu}
        ></div>
        
        {/* Add Indicator Manager */}
        {activeIndicators.length > 0 && (
          <IndicatorManager
            activeIndicators={activeIndicators}
            onRemoveIndicator={handleRemoveIndicator}
            onUpdateIndicator={handleUpdateIndicator}
          />
        )}
        
        {/* Context Menu */}
        {contextMenu.visible && (
          <div 
            className="chart-context-menu"
            style={{ 
              position: 'fixed', 
              top: `${contextMenu.y}px`, 
              left: `${contextMenu.x}px`,
              zIndex: 1000
            }}
          >
            <ul>
              <li onClick={handleResetChart}>Reset Chart</li>
              <li onClick={() => {
                // Capture and save chart as image
                if (chartContainerRef.current) {
                  try {
                    // First, try to get the chart canvas
                    const chartCanvas = chartContainerRef.current.querySelector('canvas');
                    
                    if (chartCanvas) {
                      // Create a temporary canvas to include some padding and information
                      const tempCanvas = document.createElement('canvas');
                      const tempCtx = tempCanvas.getContext('2d');
                      
                      // Make the temp canvas slightly larger to add metadata
                      tempCanvas.width = chartCanvas.width;
                      tempCanvas.height = chartCanvas.height + 40; // Extra space for text
                      
                      // Fill with background color based on theme
                      tempCtx.fillStyle = isDarkMode ? '#000000' : '#ffffff';
                      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                      
                      // Draw the chart on the temp canvas
                      tempCtx.drawImage(chartCanvas, 0, 40, chartCanvas.width, chartCanvas.height - 40);
                      
                      // Add metadata text
                      tempCtx.font = '14px Arial';
                      tempCtx.fillStyle = isDarkMode ? '#D9D9D9' : '#191919';
                      tempCtx.fillText(`${symbol} ${timeframe} - ${formattedDate} ${formattedTime}`, 10, 25);
                      
                      // Convert to data URL
                      const dataUrl = tempCanvas.toDataURL('image/png');
                      
                      // Create a download link
                      const link = document.createElement('a');
                      link.download = `${symbol}_${timeframe}_chart_${new Date().toISOString().slice(0, 10)}.png`;
                      link.href = dataUrl;
                      
                      // Trigger download
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      showSuccess('Chart image saved successfully');
                    } else {
                      // If canvas method fails, try html2canvas fallback
                      import('html2canvas').then(({ default: html2canvas }) => {
                        html2canvas(chartContainerRef.current).then(canvas => {
                          const dataUrl = canvas.toDataURL('image/png');
                          const link = document.createElement('a');
                          link.download = `${symbol}_${timeframe}_chart_${new Date().toISOString().slice(0, 10)}.png`;
                          link.href = dataUrl;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          showSuccess('Chart image saved successfully');
                        });
                      }).catch(err => {
                        showError('Failed to save chart image: ' + err.message);
                      });
                    }
                  } catch (error) {
                    console.error('Error saving chart:', error);
                    showError('Failed to save chart image: ' + error.message);
                  }
                }
                setContextMenu({ ...contextMenu, visible: false });
              }}>Save Chart</li>
            </ul>
          </div>
        )}
        
        {/* Replace the order form overlay with the side panel */}
        {showOrderForm && (
          <OrderForm
            symbol={symbol}
            currentPrice={currentPrice}
            direction={orderDirection}
            onClose={handleCloseOrderForm}
          />
        )}
      </div>
      
      {/* Add Indicator Selector */}
      <IndicatorSelector
        open={indicatorSelectorOpen}
        onClose={handleCloseIndicatorSelector}
        onAddIndicator={handleAddIndicator}
      />
    </div>
  );
};

export default TradingChart;