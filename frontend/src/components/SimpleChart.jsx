import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { fetchCandles } from '../services/api'
import './TradingChart.css'

const SimpleChart = () => {
  const chartContainerRef = useRef(null)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [timeframe, setTimeframe] = useState('1h')
  const { isDarkMode } = useTheme()
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    const getChartData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const data = await fetchCandles(symbol, timeframe)
        setChartData(data)
      } catch (err) {
        console.error('Failed to load chart data:', err)
        setError('Failed to load chart data. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    getChartData()
  }, [symbol, timeframe])
  
  // Draw a simple canvas chart
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0 || loading || error) return
    
    const canvas = document.createElement('canvas')
    canvas.width = chartContainerRef.current.clientWidth
    canvas.height = 500
    chartContainerRef.current.innerHTML = ''
    chartContainerRef.current.appendChild(canvas)
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear the canvas
    ctx.fillStyle = isDarkMode ? '#1E2130' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Find min and max values
    let minPrice = Number.MAX_VALUE
    let maxPrice = Number.MIN_VALUE
    
    chartData.forEach(candle => {
      minPrice = Math.min(minPrice, candle.low)
      maxPrice = Math.max(maxPrice, candle.high)
    })
    
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1
    const yMin = minPrice - padding
    const yMax = maxPrice + padding
    
    // Draw grid
    ctx.strokeStyle = isDarkMode ? '#2B2B43' : '#E6E6E6'
    ctx.lineWidth = 0.5
    
    // Horizontal grid lines
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * canvas.height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
      
      // Price labels
      const price = yMax - (i / 4) * (yMax - yMin)
      ctx.fillStyle = isDarkMode ? '#D9D9D9' : '#191919'
      ctx.font = '12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(price.toFixed(2), 5, y - 5)
    }
    
    // Draw candles
    const candleWidth = canvas.width / chartData.length
    
    chartData.forEach((candle, i) => {
      const x = i * candleWidth
      const open = ((yMax - candle.open) / (yMax - yMin)) * canvas.height
      const close = ((yMax - candle.close) / (yMax - yMin)) * canvas.height
      const high = ((yMax - candle.high) / (yMax - yMin)) * canvas.height
      const low = ((yMax - candle.low) / (yMax - yMin)) * canvas.height
      
      // Candle body
      ctx.fillStyle = candle.close > candle.open ? '#26a69a' : '#ef5350'
      const bodyHeight = Math.abs(close - open)
      ctx.fillRect(x, Math.min(open, close), candleWidth - 2, bodyHeight)
      
      // Candle wicks
      ctx.strokeStyle = candle.close > candle.open ? '#26a69a' : '#ef5350'
      ctx.beginPath()
      ctx.moveTo(x + candleWidth / 2, high)
      ctx.lineTo(x + candleWidth / 2, Math.min(open, close))
      ctx.moveTo(x + candleWidth / 2, Math.max(open, close))
      ctx.lineTo(x + candleWidth / 2, low)
      ctx.stroke()
    })
    
  }, [chartData, loading, error, isDarkMode])
  
  return (
    <div className={`chart-container ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="chart-controls">
        <select 
          value={symbol} 
          onChange={(e) => setSymbol(e.target.value)}
          className="chart-select"
        >
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="SOLUSDT">SOL/USDT</option>
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
      </div>
      
      <div ref={chartContainerRef} className="chart-area">
        {loading && (
          <div className="chart-loading">
            <p>Loading chart data...</p>
          </div>
        )}
        
        {error && (
          <div className="chart-error">
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SimpleChart;
