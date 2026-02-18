const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('phone').matches(/^\+?[1-9]\d{1,14}$/),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty()
  ],
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  validate,
  authController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', auth, authController.getProfile);

/**
 * @route   PUT /api/auth/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put(
  '/preferences',
  auth,
  [
    body('detourTolerance').optional().isFloat({ min: 0, max: 1 }),
    body('maxWaitTime').optional().isInt({ min: 0 }),
    body('preferredVehicleType').optional().isIn(['sedan', 'suv', 'van', 'any'])
  ],
  validate,
  authController.updatePreferences
);

module.exports = router;