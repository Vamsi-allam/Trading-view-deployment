import aiohttp
from typing import Dict, List, Any, Optional
import os
import time
import hmac
import hashlib
from urllib.parse import urlencode
import logging
import random
import math
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exchange_service")

class ExchangeService:
    # Class variable to track if geo-restriction has been logged
    _geo_restriction_logged = False
    
    def __init__(self):
        # API keys
        self.api_key = os.getenv("BINANCE_API_KEY", "")
        self.api_secret = os.getenv("BINANCE_API_SECRET", "")
        self.base_url = "https://api.binance.com"
        
        # Price caching and simulation state
        self.last_price_cache = {}
        self.last_update_time = {}
        self.price_trends = {}  # Track price movement trends
        self.geo_restricted = False  # Flag to track if we're in a restricted region
        self.fallback_mode = False   # Flag to indicate we're in fallback mode
        self.simulation_log_count = 0  # Counter to control simulation logging frequency
        
        # Base prices for simulation
        self.base_prices = {
            'BTCUSDT': 65000.0,
            'ETHUSDT': 3500.0,
            'SOLUSDT': 140.0,
            'BNBUSDT': 580.0,
            'XRPUSDT': 0.55,
            'DOGEUSDT': 0.12,
            'AVAXUSDT': 28.0,
            'ADAUSDT': 0.45,
            'LTCUSDT': 85.0,
        }
        
        # Initialize price trends with random directions
        for symbol in self.base_prices:
            self.price_trends[symbol] = {
                'direction': random.choice([1, -1]),  # 1 for up, -1 for down
                'strength': random.uniform(0.3, 1.0),  # Trend strength
                'duration': random.randint(10, 30),    # How many updates before changing
                'updates': 0                           # Counter for updates
            }
        
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None, method: str = "GET") -> Any:
        url = f"{self.base_url}{endpoint}"
        
        # If already confirmed to be geo-restricted, fail fast
        if self.geo_restricted and endpoint != "/api/v3/exchangeInfo":
            raise Exception("Service unavailable from this location due to regulatory restrictions")
        
        try:
            async with aiohttp.ClientSession() as session:
                if method == "GET":
                    async with session.get(url, params=params, timeout=10) as response:
                        if response.status != 200:
                            text = await response.text()
                            
                            # Check for geo-restriction error
                            if response.status == 451:
                                self.geo_restricted = True
                                # Only log this once per class, using the class variable
                                if not ExchangeService._geo_restriction_logged:
                                    logger.warning("Binance API access is geo-restricted. Switching to simulation mode.")
                                    ExchangeService._geo_restriction_logged = True
                                raise Exception(f"API request failed with status 451: {text}")
                            
                            logger.error(f"API request failed: {text}")
                            raise Exception(f"API request failed with status {response.status}: {text}")
                        return await response.json()
                elif method == "POST":
                    async with session.post(url, json=params, timeout=10) as response:
                        if response.status != 200:
                            text = await response.text()
                            
                            # Check for geo-restriction error
                            if response.status == 451:
                                self.geo_restricted = True
                                # Only log this once per class, using the class variable
                                if not ExchangeService._geo_restriction_logged:
                                    logger.warning("Binance API access is geo-restricted. Switching to simulation mode.")
                                    ExchangeService._geo_restriction_logged = True
                                raise Exception(f"API request failed with status 451: {text}")
                            
                            logger.error(f"API request failed: {text}")
                            raise Exception(f"API request failed with status {response.status}: {text}")
                        return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"Network error in _make_request: {str(e)}")
            raise Exception(f"Network error when connecting to exchange: {str(e)}")
        except Exception as e:
            # Only log unexpected errors that aren't 451 errors to reduce log spam
            if not str(e).startswith("API request failed with status 451"):
                logger.error(f"Unexpected error in _make_request: {str(e)}")
            raise
    
    async def _make_signed_request(self, endpoint: str, params: Dict = None) -> Any:
        if params is None:
            params = {}
            
        # Add timestamp
        params['timestamp'] = int(time.time() * 1000)
        
        # Create signature
        query_string = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        params['signature'] = signature
        
        # Add API key to headers
        headers = {'X-MBX-APIKEY': self.api_key}
        
        url = f"{self.base_url}{endpoint}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"API request failed: {text}")
                return await response.json()
    
    def _generate_simulated_price(self, symbol: str) -> float:
        """
        Generate a more realistic simulated price based on trends and patterns
        rather than just random noise.
        """
        base_price = self.base_prices.get(symbol, 100.0)
        now = time.time()
        
        # If this is the first call for this symbol, initialize it with the base price
        if symbol not in self.last_price_cache:
            self.last_price_cache[symbol] = base_price
            self.last_update_time[symbol] = now
            return base_price
        
        # Get the last price and update time
        last_price = self.last_price_cache[symbol]
        last_update = self.last_update_time[symbol]
        time_diff = now - last_update
        
        # Get current trend info
        trend = self.price_trends[symbol]
        
        # Update trend if it's time to change
        trend['updates'] += 1
        if trend['updates'] >= trend['duration']:
            # 30% chance to reverse trend, 70% chance to modify strength
            if random.random() < 0.3:
                trend['direction'] *= -1  # Reverse direction
            
            trend['strength'] = random.uniform(0.3, 1.0)
            trend['duration'] = random.randint(10, 30)
            trend['updates'] = 0
        
        # Calculate price change factors
        
        # 1. Trend factor (consistent direction movement)
        trend_factor = trend['direction'] * trend['strength'] * 0.001
        
        # 2. Random noise (market volatility)
        noise_factor = random.uniform(-0.002, 0.002)
        
        # 3. Time-based factor (larger changes for longer time gaps)
        time_factor = min(time_diff / 10, 0.01) * random.uniform(0.5, 1.5)
        
        # 4. Sine wave factor (to simulate some cyclical behavior)
        cycle_position = (now % 3600) / 3600  # Position in a 1-hour cycle
        sine_factor = 0.0005 * math.sin(cycle_position * 2 * math.pi)
        
        # 5. Apply proportionally larger movement to higher-value coins
        value_factor = 1.0
        if last_price > 1000:  # BTC, ETH
            value_factor = 1.2
        elif last_price > 100:  # BNB
            value_factor = 1.0
        elif last_price < 1:    # Small coins
            value_factor = 0.8
        
        # Combine all factors
        total_change_percent = (trend_factor + noise_factor + sine_factor) * time_factor * value_factor
        
        # Calculate new price
        new_price = last_price * (1 + total_change_percent)
        
        # Update the cache
        self.last_price_cache[symbol] = new_price
        self.last_update_time[symbol] = now
        
        return new_price
    
    async def get_current_price(self, symbol: str) -> float:
        """Get current price for a symbol with error handling and fallbacks"""
        try:
            # If we already know we're geo-restricted, skip the API call
            if self.geo_restricted:
                raise Exception("Using simulation mode due to geo-restrictions")
                
            # Try to get from Binance API
            endpoint = "/api/v3/ticker/price"
            params = {"symbol": symbol}
            
            logger.info(f"Fetching price for {symbol}")
            response = await self._make_request(endpoint, params)
            price = float(response["price"])
            
            # Update simulation base with real data
            if symbol in self.base_prices:
                self.base_prices[symbol] = price
            
            # Cache the last valid price
            self.last_price_cache[symbol] = price
            self.last_update_time[symbol] = time.time()
            self.fallback_mode = False
            
            logger.info(f"Successfully fetched price for {symbol}: {price}")
            return price
            
        except Exception as e:
            # Only log the full error message if it's not about geo-restrictions
            if not self.geo_restricted and not str(e).startswith("API request failed with status 451"):
                logger.error(f"Error fetching price for {symbol}: {str(e)}")
            elif not self.fallback_mode:
                # Log once when switching to fallback mode
                logger.warning(f"Switching to price simulation for {symbol}")
                self.fallback_mode = True
            
            # Generate a simulated price based on trends and patterns
            simulated_price = self._generate_simulated_price(symbol)
            
            # Log simulated prices less frequently to reduce noise
            self.simulation_log_count += 1
            if self.simulation_log_count % 10 == 0:  # Log only every 10th request
                logger.info(f"Using simulated price for {symbol}: {simulated_price}")
                self.simulation_log_count = 0
            
            return simulated_price
    
    async def get_candles(self, symbol: str, interval: str, limit: int = 5000) -> List[Dict]:
        """
        Get candlestick data from Binance or generate simulated data
        if the API is not accessible
        """
        try:
            # If we already know we're geo-restricted, skip the API call
            if self.geo_restricted:
                return self._generate_simulated_candles(symbol, interval, limit)
                
            endpoint = "/api/v3/klines"
            max_per_request = 1000  # Binance API limit per request
            
            # Calculate number of requests needed
            num_requests = (limit + max_per_request - 1) // max_per_request  # Ceiling division
            num_requests = min(num_requests, 5)  # Limit to 5 requests (5000 candles)
            
            all_candles = []
            end_time = None
            
            # Make multiple requests if needed
            for _ in range(num_requests):
                params = {
                    "symbol": symbol,
                    "interval": interval,
                    "limit": max_per_request
                }
                
                # Add endTime parameter for pagination if we have it
                if end_time:
                    params["endTime"] = end_time
                
                response = await self._make_request(endpoint, params)
                
                # Break if no more candles
                if not response:
                    break
                    
                # Format candles
                formatted_batch = []
                for candle in response:
                    formatted_batch.append({
                        "time": candle[0] / 1000,  # Convert from ms to seconds
                        "open": float(candle[1]),
                        "high": float(candle[2]),
                        "low": float(candle[3]),
                        "close": float(candle[4]),
                        "volume": float(candle[5])
                    })
                
                # Add to our collection
                all_candles = formatted_batch + all_candles  # Prepend as we're going backward in time
                
                # If we got fewer than requested, we've reached the limit
                if len(response) < max_per_request:
                    break
                    
                # Set the end time for the next request to be 1ms before the oldest candle
                end_time = response[0][0] - 1
                
                # If we've collected enough candles, stop
                if len(all_candles) >= limit:
                    break
            
            # Trim to requested limit and ensure correct order (oldest to newest)
            return all_candles[-limit:] if len(all_candles) > limit else all_candles
            
        except Exception as e:
            logger.warning(f"Error fetching candles for {symbol}: {str(e)}")
            logger.info(f"Generating simulated candle data for {symbol}")
            return self._generate_simulated_candles(symbol, interval, limit)
    
    def _generate_simulated_candles(self, symbol: str, interval: str, limit: int) -> List[Dict]:
        """Generate realistic-looking simulated candle data"""
        interval_seconds = {
            '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
            '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800,
            '12h': 43200, '1d': 86400, '3d': 259200, '1w': 604800
        }.get(interval, 3600)  # Default to 1h if interval not recognized
        
        # Get base price from cached data or fallback
        base_price = self.base_prices.get(symbol, 100.0)
        
        # Generate candles
        candles = []
        now = int(time.time())
        
        # Start from oldest candle
        current_time = now - (interval_seconds * limit)
        price = base_price * random.uniform(0.8, 1.2)  # Start with some variation
        
        # Generate a volatility factor for this symbol
        if symbol in ['BTCUSDT', 'ETHUSDT']:
            volatility = 0.02  # 2% for major coins
        elif symbol in ['SOLUSDT', 'BNBUSDT', 'AVAXUSDT']:
            volatility = 0.03  # 3% for mid-cap
        else:
            volatility = 0.04  # 4% for smaller coins
            
        # Simulate a general market trend (bull or bear)
        market_trend = random.choice([1, -1])  # 1 for bull, -1 for bear
        trend_strength = random.uniform(0.1, 0.3)
        
        # Generate candles
        for i in range(limit):
            # Calculate price movement
            trend_factor = market_trend * trend_strength * random.uniform(0.5, 1.5)
            random_factor = random.uniform(-1, 1) * volatility
            
            # Add some cyclical patterns
            cycle_position = (i % 20) / 20  # Position in a 20-candle cycle
            cycle_factor = 0.005 * math.sin(cycle_position * 2 * math.pi)
            
            # Combined price change
            price_change = price * (trend_factor + random_factor + cycle_factor)
            
            # Calculate candle values
            candle_open = price
            candle_close = price + price_change
            
            # Determine high and low with some randomness
            price_range = abs(candle_close - candle_open) * random.uniform(1.2, 2.0)
            if candle_open > candle_close:  # Bearish candle
                candle_high = candle_open + (price_range * random.uniform(0.1, 0.4))
                candle_low = candle_close - (price_range * random.uniform(0.6, 0.9))
            else:  # Bullish candle
                candle_high = candle_close + (price_range * random.uniform(0.6, 0.9))
                candle_low = candle_open - (price_range * random.uniform(0.1, 0.4))
            
            # Generate volume with some correlation to price movement
            base_volume = base_price * random.uniform(10, 100)
            volume_factor = 1 + (abs(price_change) / price) * random.uniform(5, 15)
            volume = base_volume * volume_factor
            
            # Create candle
            candle = {
                "time": current_time,
                "open": candle_open,
                "high": candle_high,
                "low": candle_low,
                "close": candle_close,
                "volume": volume
            }
            
            candles.append(candle)
            
            # Update for next candle
            current_time += interval_seconds
            price = candle_close
            
            # Occasionally change market trend
            if random.random() < 0.05:  # 5% chance per candle
                market_trend *= -1
            
            # Occasionally change trend strength
            if random.random() < 0.1:  # 10% chance per candle
                trend_strength = random.uniform(0.1, 0.3)
        
        return candles
    
    async def get_exchange_info(self) -> Dict:
        """Get exchange information or return simulated data if API is not accessible"""
        try:
            if self.geo_restricted:
                return self._get_simulated_exchange_info()
                
            endpoint = "/api/v3/exchangeInfo"
            response = await self._make_request(endpoint)
            
            # Filter only necessary information
            symbols_info = []
            for symbol in response["symbols"]:
                if symbol["status"] == "TRADING":
                    symbols_info.append({
                        "symbol": symbol["symbol"],
                        "baseAsset": symbol["baseAsset"],
                        "quoteAsset": symbol["quoteAsset"]
                    })
                    
            return {
                "symbols": symbols_info,
                "timezone": response["timezone"],
                "serverTime": response["serverTime"]
            }
        except Exception as e:
            logger.warning(f"Error fetching exchange info: {str(e)}")
            return self._get_simulated_exchange_info()
    
    def _get_simulated_exchange_info(self) -> Dict:
        """Generate simulated exchange information"""
        # Create a list of common trading pairs
        symbols = [
            {"symbol": "BTCUSDT", "baseAsset": "BTC", "quoteAsset": "USDT"},
            {"symbol": "ETHUSDT", "baseAsset": "ETH", "quoteAsset": "USDT"},
            {"symbol": "SOLUSDT", "baseAsset": "SOL", "quoteAsset": "USDT"},
            {"symbol": "BNBUSDT", "baseAsset": "BNB", "quoteAsset": "USDT"},
            {"symbol": "XRPUSDT", "baseAsset": "XRP", "quoteAsset": "USDT"},
            {"symbol": "DOGEUSDT", "baseAsset": "DOGE", "quoteAsset": "USDT"},
            {"symbol": "AVAXUSDT", "baseAsset": "AVAX", "quoteAsset": "USDT"},
            {"symbol": "ADAUSDT", "baseAsset": "ADA", "quoteAsset": "USDT"},
            {"symbol": "LTCUSDT", "baseAsset": "LTC", "quoteAsset": "USDT"},
            {"symbol": "DOTUSDT", "baseAsset": "DOT", "quoteAsset": "USDT"}
        ]
        
        return {
            "symbols": symbols,
            "timezone": "UTC",
            "serverTime": int(time.time() * 1000)
        }
