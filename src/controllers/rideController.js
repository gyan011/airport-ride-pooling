const RideRequest = require('../models/RideRequest');
const RidePool = require('../models/RidePool');
const MatchingEngine = require('../services/matchingEngine');
const PricingEngine = require('../services/pricingEngine');
const DistanceCalculator = require('../utils/distanceCalculator');
const config = require('../config/config');
const logger = require('../utils/logger');
const { redisLock, redisCache } = require('../config/database');

// Initialize matching engine
const matchingEngine = new MatchingEngine(redisLock);

/**
 * Create a new ride request
 */
exports.createRideRequest = async (req, res) => {
  try {
    const {
      pickupLocation,
      pickupAddress,
      dropoffLocation,
      dropoffAddress,
      passengers,
      luggage,
      detourTolerance
    } = req.body;

    // Calculate estimated distance and price
    const distance = DistanceCalculator.calculateDistance(
      pickupLocation,
      dropoffLocation
    );
    const duration = DistanceCalculator.estimateDuration(distance);
    const estimatedPrice = PricingEngine.calculateBasePrice(distance, duration);

    // Create ride request
    const rideRequest = new RideRequest({
      userId: req.userId,
      pickupLocation: {
        type: 'Point',
        coordinates: pickupLocation.coordinates
      },
      pickupAddress,
      dropoffLocation: {
        type: 'Point',
        coordinates: dropoffLocation.coordinates
      },
      dropoffAddress,
      passengers,
      luggage,
      detourTolerance: detourTolerance || req.user.preferences.detourTolerance,
      expiresAt: new Date(Date.now() + config.MATCHING_TIMEOUT_MS),
      metadata: {
        estimatedDistance: distance,
        estimatedDuration: duration,
        estimatedPrice: estimatedPrice
      }
    });

    await rideRequest.save();

    // Process matching asynchronously
    const matchResult = await matchingEngine.processRideRequest(rideRequest);

    logger.info(`Ride request ${rideRequest._id} processed: ${JSON.stringify(matchResult)}`);

    res.status(201).json({
      success: true,
      data: {
        requestId: rideRequest._id,
        poolId: matchResult.poolId,
        isNewPool: matchResult.isNewPool,
        estimatedPrice: matchResult.estimatedPrice,
        detour: matchResult.detour,
        status: 'matched'
      }
    });

  } catch (error) {
    logger.error('Create ride request error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create ride request'
    });
  }
};

/**
 * Get ride pool details
 */
exports.getRidePool = async (req, res) => {
  try {
    const { poolId } = req.params;

    const pool = await RidePool.findById(poolId)
      .populate('passengers.userId', 'name phone')
      .lean();

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: 'Ride pool not found'
      });
    }

    // Check if user is part of this pool
    const isPassenger = pool.passengers.some(
      p => p.userId._id.toString() === req.userId.toString()
    );

    if (!isPassenger) {
      return res.status(403).json({
        success: false,
        error: 'You are not part of this ride pool'
      });
    }

    res.json({
      success: true,
      data: { pool }
    });

  } catch (error) {
    logger.error('Get ride pool error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ride pool'
    });
  }
};

/**
 * Get user's active rides
 */
exports.getActiveRides = async (req, res) => {
  try {
    const pools = await RidePool.find({
      'passengers.userId': req.userId,
      status: { $in: ['forming', 'matched', 'active'] }
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: { rides: pools }
    });

  } catch (error) {
    logger.error('Get active rides error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active rides'
    });
  }
};

/**
 * Get user's ride history
 */
exports.getRideHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const pools = await RidePool.find({
      'passengers.userId': req.userId,
      status: { $in: ['completed', 'cancelled'] }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const total = await RidePool.countDocuments({
      'passengers.userId': req.userId,
      status: { $in: ['completed', 'cancelled'] }
    });

    res.json({
      success: true,
      data: {
        rides: pools,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get ride history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ride history'
    });
  }
};

/**
 * Cancel a ride
 */
exports.cancelRide = async (req, res) => {
  try {
    const { poolId } = req.params;

    const result = await matchingEngine.cancelRide(req.userId, poolId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to cancel ride'
      });
    }

    logger.info(`Ride cancelled by user ${req.userId} in pool ${poolId}`);

    res.json({
      success: true,
      data: {
        message: 'Ride cancelled successfully',
        pool: result.pool
      }
    });

  } catch (error) {
    logger.error('Cancel ride error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel ride'
    });
  }
};

/**
 * Get current pricing for a route
 */
exports.getPriceEstimate = async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation } = req.body;

    const distance = DistanceCalculator.calculateDistance(
      pickupLocation,
      dropoffLocation
    );
    const duration = DistanceCalculator.estimateDuration(distance);

    // Get current demand
    const demandData = await PricingEngine.getCurrentDemand('airport', redisCache);

    // Calculate price
    const basePrice = PricingEngine.calculateBasePrice(distance, duration);
    const timeMultiplier = PricingEngine.getTimeMultiplier();
    const distanceDiscount = PricingEngine.getDistanceDiscount(distance);

    const soloPrice = PricingEngine.calculateDynamicPrice({
      basePrice,
      demandMultiplier: demandData.surgeFactor,
      timeMultiplier,
      distanceDiscount,
      poolingDiscount: 0
    });

    const pooledPrice = PricingEngine.calculateDynamicPrice({
      basePrice,
      demandMultiplier: demandData.surgeFactor,
      timeMultiplier,
      distanceDiscount,
      poolingDiscount: 0.25 // Estimated 25% pool discount
    });

    res.json({
      success: true,
      data: {
        soloPrice,
        pooledPrice,
        estimatedDistance: distance,
        estimatedDuration: duration,
        demandLevel: demandData.demandLevel,
        surgeFactor: demandData.surgeFactor
      }
    });

  } catch (error) {
    logger.error('Get price estimate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get price estimate'
    });
  }
};

/**
 * Get pool statistics
 */
exports.getPoolStats = async (req, res) => {
  try {
    const stats = await RidePool.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgPassengers: { $avg: { $size: '$passengers' } },
          avgDistance: { $avg: '$route.totalDistance' }
        }
      }
    ]);

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Get pool stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
};