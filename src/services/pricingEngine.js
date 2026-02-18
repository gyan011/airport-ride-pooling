const config = require('../config/config');
const logger = require('../utils/logger');

class PricingEngine {
  /**
   * Calculate base price for a ride
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} durationMin - Duration in minutes
   * @returns {number} Base price in dollars
   */
  static calculateBasePrice(distanceKm, durationMin) {
    const distancePrice = distanceKm * config.BASE_RATE_PER_KM;
    const timePrice = durationMin * config.BASE_RATE_PER_MIN;
    const basePrice = distancePrice + timePrice + config.AIRPORT_FEE;

    return Math.max(basePrice, config.MINIMUM_FARE);
  }

  /**
   * Calculate demand multiplier based on supply/demand ratio
   * @param {number} activeRequests - Number of active requests
   * @param {number} availableCabs - Number of available cabs
   * @returns {number} Multiplier between 1.0 and 2.5
   */
  static calculateDemandMultiplier(activeRequests, availableCabs) {
    const ratio = activeRequests / Math.max(availableCabs, 1);

    if (ratio < 0.5) return 1.0;      // Low demand
    if (ratio < 1.0) return 1.2;      // Normal demand
    if (ratio < 1.5) return 1.5;      // High demand
    if (ratio < 2.0) return 2.0;      // Very high demand
    return 2.5;                        // Surge pricing
  }

  /**
   * Get time-of-day multiplier
   * @param {Date} date - Current date/time
   * @returns {number} Time multiplier
   */
  static getTimeMultiplier(date = new Date()) {
    const hour = date.getHours();

    if (hour >= 6 && hour < 9) return 1.3;   // Morning rush (6am-9am)
    if (hour >= 17 && hour < 20) return 1.4; // Evening rush (5pm-8pm)
    if (hour >= 0 && hour < 6) return 1.2;   // Late night (12am-6am)
    return 1.0; // Normal hours
  }

  /**
   * Calculate pooling discount
   * @param {number} passengersCount - Number of passengers in pool
   * @param {number} detourPercentage - Detour percentage (0-1)
   * @returns {number} Discount percentage (0-1)
   */
  static calculatePoolingDiscount(passengersCount, detourPercentage) {
    // Base discount increases with more passengers
    // 2 passengers: 15%, 3: 30%, 4+: 45%
    const baseDiscount = Math.min((passengersCount - 1) * 0.15, 0.45);

    // Reduce discount based on detour (passenger pays for inconvenience)
    const detourPenalty = detourPercentage * 0.3;

    // Minimum 10% discount for pooling
    return Math.max(baseDiscount - detourPenalty, 0.10);
  }

  /**
   * Calculate distance-based discount
   * @param {number} distanceKm - Distance in kilometers
   * @returns {number} Discount factor (0.9 for long trips, 1.0 otherwise)
   */
  static getDistanceDiscount(distanceKm) {
    if (distanceKm > 20) return 0.90; // 10% discount for trips > 20km
    if (distanceKm > 50) return 0.85; // 15% discount for trips > 50km
    return 1.0;
  }

  /**
   * Get loyalty discount based on user tier
   * @param {string} userTier - 'basic', 'premium', or 'vip'
   * @returns {number} Discount factor
   */
  static getLoyaltyDiscount(userTier) {
    const discounts = {
      'basic': 1.0,
      'premium': 0.95,  // 5% discount
      'vip': 0.90       // 10% discount
    };

    return discounts[userTier] || 1.0;
  }

  /**
   * Calculate price for a passenger joining a pool
   * @param {Object} rideRequest - Ride request data
   * @param {Object} pool - Current pool data
   * @param {number} detourPercentage - Detour caused by this passenger
   * @param {Object} demandData - Optional demand data { activeRequests, availableCabs }
   * @returns {number} Final price for this passenger
   */
  static calculatePassengerPrice(rideRequest, pool, detourPercentage, demandData = null) {
    const DistanceCalculator = require('../utils/distanceCalculator');

    // Calculate direct distance for this passenger
    const directDistance = DistanceCalculator.calculateDistance(
      rideRequest.pickupLocation,
      rideRequest.dropoffLocation
    );

    const directDuration = DistanceCalculator.estimateDuration(directDistance);

    // Step 1: Base price
    let price = this.calculateBasePrice(directDistance, directDuration);

    logger.debug(`Base price for distance ${directDistance}km: $${price.toFixed(2)}`);

    // Step 2: Apply surge pricing (if demand data available)
    if (demandData) {
      const demandMultiplier = this.calculateDemandMultiplier(
        demandData.activeRequests,
        demandData.availableCabs
      );
      price *= demandMultiplier;
      logger.debug(`After demand multiplier ${demandMultiplier}: $${price.toFixed(2)}`);
    } else {
      // Use stored surge factor from pool
      price *= pool.pricing.surgeFactor || 1.0;
    }

    // Step 3: Apply time-of-day multiplier
    const timeMultiplier = this.getTimeMultiplier();
    price *= timeMultiplier;
    logger.debug(`After time multiplier ${timeMultiplier}: $${price.toFixed(2)}`);

    // Step 4: Apply pooling discount
    const currentPassengers = pool.passengers.length + 1; // Including this new passenger
    const poolingDiscount = this.calculatePoolingDiscount(currentPassengers, detourPercentage);
    price *= (1 - poolingDiscount);
    logger.debug(`After pooling discount ${(poolingDiscount * 100).toFixed(0)}%: $${price.toFixed(2)}`);

    // Step 5: Apply distance discount
    const distanceDiscount = this.getDistanceDiscount(directDistance);
    price *= distanceDiscount;
    logger.debug(`After distance discount: $${price.toFixed(2)}`);

    // Step 6: Apply loyalty discount (if user tier available)
    // This would require user data to be passed in
    // For now, we'll skip this step

    // Round to 2 decimal places
    return Math.round(price * 100) / 100;
  }

  /**
   * Calculate dynamic price with all factors
   * @param {Object} factors - All pricing factors
   * @returns {number} Final price
   */
  static calculateDynamicPrice(factors) {
    const {
      basePrice,
      demandMultiplier = 1.0,
      timeMultiplier = 1.0,
      poolingDiscount = 0,
      distanceDiscount = 1.0,
      loyaltyDiscount = 1.0,
      additionalFees = 0
    } = factors;

    let finalPrice = basePrice;
    finalPrice *= demandMultiplier;
    finalPrice *= timeMultiplier;
    finalPrice *= (1 - poolingDiscount);
    finalPrice *= distanceDiscount;
    finalPrice *= loyaltyDiscount;
    finalPrice += additionalFees;

    return Math.round(finalPrice * 100) / 100;
  }

  /**
   * Ensure fair pricing - individual rides shouldn't cost more than pooled
   * @param {Array} passengers - Array of passenger price data
   * @param {number} totalPoolPrice - Total price for the pool
   * @returns {Array} Adjusted passenger prices
   */
  static ensureFairPricing(passengers, totalPoolPrice) {
    // Calculate individual prices (what each would pay alone)
    const individualPrices = passengers.map(p => p.individualPrice);
    const totalIndividualPrice = individualPrices.reduce((a, b) => a + b, 0);

    // If pool price exceeds sum of individual prices, cap it
    let adjustedTotal = totalPoolPrice;
    if (totalPoolPrice > totalIndividualPrice) {
      adjustedTotal = totalIndividualPrice * 0.85; // Apply 15% pool discount
    }

    // Distribute proportionally based on individual prices
    return passengers.map((p, i) => ({
      passengerId: p.passengerId,
      price: Math.round((individualPrices[i] / totalIndividualPrice) * adjustedTotal * 100) / 100
    }));
  }

  /**
   * Get current demand level for a region
   * @param {string} region - Region identifier
   * @param {Object} redisClient - Redis client for querying demand
   * @returns {Promise<Object>} { demandLevel, surgeFactor, activeRequests, availableCabs }
   */
  static async getCurrentDemand(region, redisClient) {
    try {
      const key = `demand:${region}:${new Date().toISOString().slice(0, 13)}`; // Hourly bucket
      
      const [activeRequests, availableCabs] = await Promise.all([
        redisClient.get(`${key}:requests`) || 0,
        redisClient.get(`${key}:cabs`) || 1
      ]);

      const demandMultiplier = this.calculateDemandMultiplier(
        parseInt(activeRequests),
        parseInt(availableCabs)
      );

      let demandLevel = 'normal';
      if (demandMultiplier >= 2.0) demandLevel = 'surge';
      else if (demandMultiplier >= 1.5) demandLevel = 'high';
      else if (demandMultiplier < 1.2) demandLevel = 'low';

      return {
        demandLevel,
        surgeFactor: demandMultiplier,
        activeRequests: parseInt(activeRequests),
        availableCabs: parseInt(availableCabs)
      };

    } catch (error) {
      logger.error('Error getting current demand:', error);
      return {
        demandLevel: 'normal',
        surgeFactor: 1.0,
        activeRequests: 0,
        availableCabs: 0
      };
    }
  }
}

module.exports = PricingEngine;