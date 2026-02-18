const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const rideController = require('../controllers/rideController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

/**
 * @route   POST /api/rides/request
 * @desc    Create a new ride request
 * @access  Private
 */
router.post(
  '/request',
  auth,
  [
    body('pickupLocation.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Pickup coordinates must be [lng, lat]'),
    body('pickupLocation.coordinates.*')
      .isFloat()
      .withMessage('Coordinates must be numbers'),
    body('pickupAddress').trim().notEmpty(),
    body('dropoffLocation.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Dropoff coordinates must be [lng, lat]'),
    body('dropoffLocation.coordinates.*')
      .isFloat()
      .withMessage('Coordinates must be numbers'),
    body('dropoffAddress').trim().notEmpty(),
    body('passengers').isInt({ min: 1, max: 4 }),
    body('luggage').isInt({ min: 0, max: 6 }),
    body('detourTolerance').optional().isFloat({ min: 0, max: 1 })
  ],
  validate,
  rideController.createRideRequest
);

/**
 * @route   GET /api/rides/pool/:poolId
 * @desc    Get ride pool details
 * @access  Private
 */
router.get(
  '/pool/:poolId',
  auth,
  [param('poolId').isMongoId()],
  validate,
  rideController.getRidePool
);

/**
 * @route   GET /api/rides/active
 * @desc    Get user's active rides
 * @access  Private
 */
router.get('/active', auth, rideController.getActiveRides);

/**
 * @route   GET /api/rides/history
 * @desc    Get user's ride history
 * @access  Private
 */
router.get(
  '/history',
  auth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  rideController.getRideHistory
);

/**
 * @route   DELETE /api/rides/pool/:poolId
 * @desc    Cancel a ride
 * @access  Private
 */
router.delete(
  '/pool/:poolId',
  auth,
  [param('poolId').isMongoId()],
  validate,
  rideController.cancelRide
);

/**
 * @route   POST /api/rides/price-estimate
 * @desc    Get price estimate for a route
 * @access  Private
 */
router.post(
  '/price-estimate',
  auth,
  [
    body('pickupLocation.coordinates')
      .isArray({ min: 2, max: 2 }),
    body('dropoffLocation.coordinates')
      .isArray({ min: 2, max: 2 })
  ],
  validate,
  rideController.getPriceEstimate
);

/**
 * @route   GET /api/rides/stats
 * @desc    Get pool statistics
 * @access  Private
 */
router.get('/stats', auth, rideController.getPoolStats);

module.exports = router;