// Environment Configuration
require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI ,
  
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD  ,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
  
  // Ride Pooling Settings
  MAX_POOL_SIZE: parseInt(process.env.MAX_POOL_SIZE) || 4,
  MAX_LUGGAGE_PER_CAB: parseInt(process.env.MAX_LUGGAGE_PER_CAB) || 6,
  DEFAULT_DETOUR_TOLERANCE: parseFloat(process.env.DEFAULT_DETOUR_TOLERANCE) || 0.3, // 30%
  MATCHING_TIMEOUT_MS: parseInt(process.env.MATCHING_TIMEOUT_MS) || 30000, // 30 seconds
  POOL_FORMATION_TIME_MS: parseInt(process.env.POOL_FORMATION_TIME_MS) || 120000, // 2 minutes
  
  // Geospatial
  MATCHING_RADIUS_KM: parseFloat(process.env.MATCHING_RADIUS_KM) || 5, // 5 km radius
  
  // Pricing
  BASE_RATE_PER_KM: parseFloat(process.env.BASE_RATE_PER_KM) || 2.0,
  BASE_RATE_PER_MIN: parseFloat(process.env.BASE_RATE_PER_MIN) || 0.5,
  MINIMUM_FARE: parseFloat(process.env.MINIMUM_FARE) || 5.0,
  AIRPORT_FEE: parseFloat(process.env.AIRPORT_FEE) || 3.0,
  
  // Performance
  MAX_REQUESTS_PER_SECOND: parseInt(process.env.MAX_REQUESTS_PER_SECOND) || 100,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1000,
  
  // External Services
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  
  // Locks
  LOCK_TIMEOUT_MS: parseInt(process.env.LOCK_TIMEOUT_MS) || 5000,
  
  // Cache TTL
  CACHE_TTL_SECONDS: {
    ACTIVE_POOLS: 300, // 5 minutes
    USER_PREFERENCES: 1800, // 30 minutes
    ROUTE_CACHE: 3600, // 1 hour
  }
};
