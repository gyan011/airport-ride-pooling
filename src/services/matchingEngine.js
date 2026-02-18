const RidePool = require('../models/RidePool');
const RideRequest = require('../models/RideRequest');
const DistanceCalculator = require('../utils/distanceCalculator');
const config = require('../config/config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class MatchingEngine {
  constructor(redisLock) {
    this.redisLock = redisLock;
    this.maxPoolSize = config.MAX_POOL_SIZE;
    this.matchingRadius = config.MATCHING_RADIUS_KM;
  }

  /**
   * Process a ride request - find matching pool or create new one
   * @param {Object} rideRequest - RideRequest document
   * @returns {Object} { poolId, isNewPool, estimatedPrice }
   */
  async processRideRequest(rideRequest) {
    logger.info(`Processing ride request ${rideRequest._id} for user ${rideRequest.userId}`);

    try {
      // Step 1: Find nearby available pools
      const nearbyPools = await this.findNearbyPools(
        rideRequest.pickupLocation,
        rideRequest.passengers,
        rideRequest.luggage
      );

      logger.debug(`Found ${nearbyPools.length} nearby pools for request ${rideRequest._id}`);

      // Step 2: Try to match with existing pool
      if (nearbyPools.length > 0) {
        const matchedPool = await this.findBestMatch(rideRequest, nearbyPools);
        
        if (matchedPool) {
          const lockKey = `pool:${matchedPool._id}`;
          const lockValue = await this.acquireLock(lockKey);

          try {
            const result = await this.addToExistingPool(matchedPool, rideRequest);
            
            if (result.success) {
              logger.info(`Added request ${rideRequest._id} to existing pool ${matchedPool._id}`);
              return {
                poolId: matchedPool._id,
                isNewPool: false,
                estimatedPrice: result.price,
                detour: result.detour
              };
            }
          } finally {
            await this.releaseLock(lockKey, lockValue);
          }
        }
      }

      // Step 3: Create new pool if no match found
      const newPool = await this.createNewPool(rideRequest);
      logger.info(`Created new pool ${newPool._id} for request ${rideRequest._id}`);

      return {
        poolId: newPool._id,
        isNewPool: true,
        estimatedPrice: newPool.passengers[0].price,
        detour: 0
      };

    } catch (error) {
      logger.error(`Error processing ride request ${rideRequest._id}:`, error);
      throw error;
    }
  }

  /**
   * Find nearby available pools
   */
  async findNearbyPools(pickupLocation, requiredSeats, requiredLuggage) {
    try {
      const pools = await RidePool.find({
        status: { $in: ['forming', 'matched'] },
        $expr: {
          $and: [
            { $lte: [{ $add: ['$currentOccupancy.seats', requiredSeats] }, '$vehicle.capacity'] },
            { $lte: [{ $add: ['$currentOccupancy.luggage', requiredLuggage] }, '$vehicle.luggageCapacity'] }
          ]
        }
      })
      .limit(20)
      .lean();

      // Filter by distance (MongoDB geospatial query might not work on all stops)
      const nearbyPools = pools.filter(pool => {
        if (pool.route.stops.length === 0) return false;
        
        // Check if pickup is within radius of any stop
        return pool.route.stops.some(stop => 
          DistanceCalculator.isWithinRadius(
            pickupLocation,
            stop.location,
            this.matchingRadius
          )
        );
      });

      return nearbyPools.map(pool => ({ ...pool, _id: pool._id.toString() }));
    } catch (error) {
      logger.error('Error finding nearby pools:', error);
      return [];
    }
  }

  /**
   * Find the best matching pool based on detour and other factors
   */
  async findBestMatch(rideRequest, pools) {
    let bestPool = null;
    let minCost = Infinity;

    for (const pool of pools) {
      // Calculate detour if this request is added
      const detourResult = DistanceCalculator.calculateDetour(
        pool.route.stops,
        rideRequest.pickupLocation,
        rideRequest.dropoffLocation
      );

      // Check detour tolerance
      if (detourResult.detourPercentage > rideRequest.detourTolerance) {
        continue;
      }

      // Calculate cost metric (lower is better)
      // Cost = detour * 100 + distance_penalty + time_penalty
      const cost = 
        detourResult.detourPercentage * 100 +
        (pool.route.stops.length * 10) + // Prefer pools with fewer stops
        (pool.currentOccupancy.seats * 5); // Prefer less crowded pools

      if (cost < minCost) {
        minCost = cost;
        bestPool = {
          ...pool,
          calculatedDetour: detourResult
        };
      }
    }

    return bestPool;
  }

  /**
   * Add passenger to existing pool
   */
  async addToExistingPool(poolData, rideRequest) {
    try {
      const pool = await RidePool.findById(poolData._id);
      
      if (!pool) {
        return { success: false, error: 'Pool not found' };
      }

      // Double-check capacity
      if (!pool.canAccommodate(rideRequest.passengers, rideRequest.luggage)) {
        return { success: false, error: 'Pool is full' };
      }

      // Use pre-calculated detour
      const { detourPercentage, bestRoute } = poolData.calculatedDetour;

      // Calculate price for this passenger
      const PricingEngine = require('./pricingEngine');
      const price = PricingEngine.calculatePassengerPrice(
        rideRequest,
        pool,
        detourPercentage
      );

      // Add passenger to pool
      const passengerData = {
        userId: rideRequest.userId,
        requestId: rideRequest._id,
        pickupLocation: rideRequest.pickupLocation,
        pickupAddress: rideRequest.pickupAddress,
        dropoffLocation: rideRequest.dropoffLocation,
        dropoffAddress: rideRequest.dropoffAddress,
        price: price,
        passengerCount: rideRequest.passengers,
        luggageCount: rideRequest.luggage,
        status: 'waiting'
      };

      pool.addPassenger(passengerData);

      // Update route with best route
      pool.route.stops = bestRoute.map((stop, idx) => ({
        ...stop,
        passengerId: stop.type === 'pickup' 
          ? (stop.passengerId || rideRequest.userId)
          : (stop.passengerId || rideRequest.userId),
        sequence: idx,
        address: stop.type === 'pickup' ? rideRequest.pickupAddress : rideRequest.dropoffAddress
      }));

      pool.route.totalDistance = poolData.calculatedDetour.newDistance;
      pool.route.totalDuration = DistanceCalculator.estimateDuration(pool.route.totalDistance);
      pool.route.optimizedAt = new Date();

      // Update status if pool is ready
      if (pool.passengers.length >= 2 && pool.status === 'forming') {
        pool.status = 'matched';
        pool.matchedAt = new Date();
      }

      await pool.save();

      // Update request status
      await RideRequest.findByIdAndUpdate(rideRequest._id, {
        status: 'matched',
        matchedPoolId: pool._id
      });

      return {
        success: true,
        price: price,
        detour: detourPercentage
      };

    } catch (error) {
      logger.error('Error adding to existing pool:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new ride pool
   */
  async createNewPool(rideRequest) {
    const PricingEngine = require('./pricingEngine');
    
    // Calculate initial price
    const directDistance = DistanceCalculator.calculateDistance(
      rideRequest.pickupLocation,
      rideRequest.dropoffLocation
    );
    
    const basePrice = PricingEngine.calculateBasePrice(
      directDistance,
      DistanceCalculator.estimateDuration(directDistance)
    );

    const pool = new RidePool({
      status: 'forming',
      passengers: [{
        userId: rideRequest.userId,
        requestId: rideRequest._id,
        pickupLocation: rideRequest.pickupLocation,
        pickupAddress: rideRequest.pickupAddress,
        dropoffLocation: rideRequest.dropoffLocation,
        dropoffAddress: rideRequest.dropoffAddress,
        price: basePrice,
        passengerCount: rideRequest.passengers,
        luggageCount: rideRequest.luggage,
        status: 'waiting'
      }],
      route: {
        stops: [
          {
            type: 'pickup',
            location: rideRequest.pickupLocation,
            address: rideRequest.pickupAddress,
            passengerId: rideRequest.userId,
            sequence: 0
          },
          {
            type: 'dropoff',
            location: rideRequest.dropoffLocation,
            address: rideRequest.dropoffAddress,
            passengerId: rideRequest.userId,
            sequence: 1
          }
        ],
        totalDistance: directDistance,
        totalDuration: DistanceCalculator.estimateDuration(directDistance),
        optimizedAt: new Date()
      },
      vehicle: {
        type: 'sedan',
        capacity: config.MAX_POOL_SIZE,
        luggageCapacity: config.MAX_LUGGAGE_PER_CAB
      },
      currentOccupancy: {
        seats: rideRequest.passengers,
        luggage: rideRequest.luggage
      },
      pricing: {
        basePrice: basePrice,
        surgeFactor: 1.0,
        totalPrice: basePrice,
        poolingDiscount: 0
      }
    });

    await pool.save();

    // Update request
    await RideRequest.findByIdAndUpdate(rideRequest._id, {
      status: 'matched',
      matchedPoolId: pool._id
    });

    return pool;
  }

  /**
   * Handle ride cancellation
   */
  async cancelRide(userId, poolId) {
    const lockKey = `pool:${poolId}`;
    const lockValue = await this.acquireLock(lockKey);

    try {
      const pool = await RidePool.findById(poolId);

      if (!pool) {
        throw new Error('Pool not found');
      }

      const removed = pool.removePassenger(userId);

      if (!removed) {
        throw new Error('Passenger not found in pool');
      }

      // If pool is empty, cancel it
      if (pool.passengers.length === 0) {
        pool.status = 'cancelled';
        pool.cancelledAt = new Date();
        pool.cancelReason = 'All passengers cancelled';
      } else {
        // Recompute route without this passenger
        const newStops = pool.route.stops.filter(
          stop => stop.passengerId.toString() !== userId.toString()
        );

        pool.route.stops = newStops.map((stop, idx) => ({
          ...stop,
          sequence: idx
        }));

        pool.route.totalDistance = DistanceCalculator.calculateRouteDistance(newStops);
        pool.route.totalDuration = DistanceCalculator.estimateDuration(pool.route.totalDistance);
        pool.route.optimizedAt = new Date();
      }

      await pool.save();

      // Update request status
      const passenger = pool.passengers.find(p => p.userId.toString() === userId.toString());
      if (passenger) {
        await RideRequest.findByIdAndUpdate(passenger.requestId, {
          status: 'cancelled'
        });
      }

      logger.info(`User ${userId} cancelled from pool ${poolId}`);

      return {
        success: true,
        pool: pool
      };

    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Acquire distributed lock
   */
  async acquireLock(key, timeout = config.LOCK_TIMEOUT_MS) {
    const lockValue = uuidv4();
    const result = await this.redisLock.set(
      key,
      lockValue,
      'PX',
      timeout,
      'NX'
    );

    if (!result) {
      throw new Error(`Failed to acquire lock for ${key}`);
    }

    return lockValue;
  }

  /**
   * Release distributed lock
   */
  async releaseLock(key, lockValue) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redisLock.eval(script, 1, key, lockValue);
  }
}

module.exports = MatchingEngine;