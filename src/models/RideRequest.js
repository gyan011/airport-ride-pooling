const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true,
    default: 'Point'
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 2 && 
               v[0] >= -180 && v[0] <= 180 && // longitude
               v[1] >= -90 && v[1] <= 90;      // latitude
      },
      message: 'Invalid coordinates format [lng, lat]'
    }
  }
}, { _id: false });

const rideRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  pickupLocation: {
    type: pointSchema,
    required: true,
    index: '2dsphere'
  },
  pickupAddress: {
    type: String,
    required: true
  },
  dropoffLocation: {
    type: pointSchema,
    required: true
  },
  dropoffAddress: {
    type: String,
    required: true
  },
  passengers: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  luggage: {
    type: Number,
    required: true,
    min: 0,
    max: 6
  },
  detourTolerance: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.3
  },
  requestedTime: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'matched', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  matchedPoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RidePool',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    estimatedDistance: Number,
    estimatedDuration: Number,
    estimatedPrice: Number
  }
}, {
  timestamps: true
});

// // Compound indexes for efficient querying
// rideRequestSchema.index({ status: 1, requestedTime: 1 });
// rideRequestSchema.index({ userId: 1, status: 1 });
// rideRequestSchema.index({ pickupLocation: '2dsphere' });

// TTL index to auto-delete expired requests
// rideRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
rideRequestSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt; 
};

rideRequestSchema.methods.canMatch = function() {
  return this.status === 'pending' && !this.isExpired();
};

// Static methods
rideRequestSchema.statics.findPendingNearby = function(location, radiusKm) {
  return this.find({
    status: 'pending',
    expiresAt: { $gt: new Date() },
    pickupLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: location.coordinates
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    }
  });
};

module.exports = mongoose.model('RideRequest', rideRequestSchema);