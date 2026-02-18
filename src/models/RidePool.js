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
    required: true
  }
}, { _id: false });

const passengerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: true
  },
  pickupLocation: {
    type: pointSchema,
    required: true
  },
  pickupAddress: String,
  dropoffLocation: {
    type: pointSchema,
    required: true
  },
  dropoffAddress: String,
  pickupTime: Date,
  dropoffTime: Date,
  actualPickupTime: Date,
  actualDropoffTime: Date,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['waiting', 'picked_up', 'dropped_off', 'cancelled'],
    default: 'waiting'
  },
  passengerCount: {
    type: Number,
    required: true,
    min: 1
  },
  luggageCount: {
    type: Number,
    required: true,
    min: 0
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const stopSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pickup', 'dropoff'],
    required: true
  },
  location: {
    type: pointSchema,
    required: true
  },
  address: String,
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sequence: {
    type: Number,
    required: true
  },
  estimatedTime: Date,
  actualTime: Date,
  completed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const ridePoolSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['forming', 'matched', 'active', 'completed', 'cancelled'],
    default: 'forming',
    index: true
  },
  passengers: [passengerSchema],
  route: {
    stops: [stopSchema],
    totalDistance: {
      type: Number,
      default: 0
    },
    totalDuration: {
      type: Number,
      default: 0
    },
    optimizedAt: Date
  },
  vehicle: {
    type: {
      type: String,
      enum: ['sedan', 'suv', 'van'],
      default: 'sedan'
    },
    capacity: {
      type: Number,
      required: true,
      default: 4
    },
    luggageCapacity: {
      type: Number,
      required: true,
      default: 6
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  currentOccupancy: {
    seats: {
      type: Number,
      default: 0,
      min: 0
    },
    luggage: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  pricing: {
    basePrice: Number,
    surgeFactor: {
      type: Number,
      default: 1.0,
      min: 1.0
    },
    totalPrice: Number,
    poolingDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    }
  },
  version: {
    type: Number,
    default: 0
  },
  formationStartedAt: {
    type: Date,
    default: Date.now
  },
  matchedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  metadata: {
    region: String,
    demandLevel: {
      type: String,
      enum: ['low', 'normal', 'high', 'surge'],
      default: 'normal'
    }
  }
}, {
  timestamps: true
});

// Indexes
// ridePoolSchema.index({ status: 1, createdAt: -1 });
// ridePoolSchema.index({ 'passengers.userId': 1 });
// ridePoolSchema.index({ 'route.stops.location': '2dsphere' });
// ridePoolSchema.index({ status: 1, 'currentOccupancy.seats': 1 });
// ridePoolSchema.index({ createdAt: -1 });

// Virtual for available seats
ridePoolSchema.virtual('availableSeats').get(function() {
  return this.vehicle.capacity - this.currentOccupancy.seats;
});

ridePoolSchema.virtual('availableLuggage').get(function() {
  return this.vehicle.luggageCapacity - this.currentOccupancy.luggage;
});

// Methods
ridePoolSchema.methods.canAccommodate = function(passengers, luggage) {
  return (
    this.currentOccupancy.seats + passengers <= this.vehicle.capacity &&
    this.currentOccupancy.luggage + luggage <= this.vehicle.luggageCapacity
  );
};

ridePoolSchema.methods.addPassenger = function(passengerData) {
  this.passengers.push(passengerData);
  this.currentOccupancy.seats += passengerData.passengerCount;
  this.currentOccupancy.luggage += passengerData.luggageCount;
};

ridePoolSchema.methods.removePassenger = function(userId) {
  const passenger = this.passengers.find(p => p.userId.toString() === userId.toString());
  
  if (passenger) {
    this.currentOccupancy.seats -= passenger.passengerCount;
    this.currentOccupancy.luggage -= passenger.luggageCount;
    this.passengers = this.passengers.filter(p => p.userId.toString() !== userId.toString());
    return true;
  }
  
  return false;
};

ridePoolSchema.methods.isFull = function() {
  return this.currentOccupancy.seats >= this.vehicle.capacity;
};

ridePoolSchema.methods.isActive = function() {
  return ['forming', 'matched', 'active'].includes(this.status);
};

// Static methods
ridePoolSchema.statics.findAvailableNearby = function(location, radiusKm, requiredSeats, requiredLuggage) {
  return this.find({
    status: { $in: ['forming', 'matched'] },
    'route.stops.location': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: location.coordinates
        },
        $maxDistance: radiusKm * 1000
      }
    },
    $expr: {
      $and: [
        { $lte: [{ $add: ['$currentOccupancy.seats', requiredSeats] }, '$vehicle.capacity'] },
        { $lte: [{ $add: ['$currentOccupancy.luggage', requiredLuggage] }, '$vehicle.luggageCapacity'] }
      ]
    }
  });
};

// Pre-save middleware for version control (optimistic locking)
ridePoolSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.increment();
  }
  next();
});

module.exports = mongoose.model('RidePool', ridePoolSchema);