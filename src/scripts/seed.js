const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/User');
const RideRequest = require('../models/RideRequest');
const RidePool = require('../models/RidePool');
const logger = require('../utils/logger');

// Sample data
const sampleUsers = [
  {
    email: 'john.doe@example.com',
    phone: '+11234567890',
    password: 'password123',
    name: 'John Doe',
    tier: 'basic'
  },
  {
    email: 'jane.smith@example.com',
    phone: '+11234567891',
    password: 'password123',
    name: 'Jane Smith',
    tier: 'premium'
  },
  {
    email: 'bob.wilson@example.com',
    phone: '+11234567892',
    password: 'password123',
    name: 'Bob Wilson',
    tier: 'basic'
  },
  {
    email: 'alice.johnson@example.com',
    phone: '+11234567893',
    password: 'password123',
    name: 'Alice Johnson',
    tier: 'vip'
  },
  {
    email: 'charlie.brown@example.com',
    phone: '+11234567894',
    password: 'password123',
    name: 'Charlie Brown',
    tier: 'basic'
  }
];

// Airport coordinates (San Francisco Airport)
const airportLocation = {
  type: 'Point',
  coordinates: [-122.3789, 37.6213]
};

// Sample destination coordinates (various SF locations)
const destinations = [
  { coordinates: [-122.4194, 37.7749], address: '123 Market St, San Francisco' },
  { coordinates: [-122.4089, 37.7858], address: '456 Mission St, San Francisco' },
  { coordinates: [-122.3972, 37.7897], address: '789 Embarcadero, San Francisco' },
  { coordinates: [-122.4312, 37.7693], address: '321 Valencia St, San Francisco' },
  { coordinates: [-122.4484, 37.7585], address: '654 Haight St, San Francisco' }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await RideRequest.deleteMany({});
    await RidePool.deleteMany({});

    // Create users
    logger.info('Creating sample users...');
    const users = await User.create(sampleUsers);
    logger.info(`Created ${users.length} users`);

    // Create some ride requests
    logger.info('Creating sample ride requests...');
    const requests = [];
    
    for (let i = 0; i < users.length; i++) {
      const request = await RideRequest.create({
        userId: users[i]._id,
        pickupLocation: airportLocation,
        pickupAddress: 'San Francisco International Airport',
        dropoffLocation: {
          type: 'Point',
          coordinates: destinations[i].coordinates
        },
        dropoffAddress: destinations[i].address,
        passengers: Math.floor(Math.random() * 3) + 1,
        luggage: Math.floor(Math.random() * 4) + 1,
        detourTolerance: 0.3,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        status: i < 3 ? 'pending' : 'matched'
      });
      
      requests.push(request);
    }
    
    logger.info(`Created ${requests.length} ride requests`);

    // Create a sample ride pool with multiple passengers
    logger.info('Creating sample ride pool...');
    const pool = await RidePool.create({
      status: 'matched',
      passengers: [
        {
          userId: users[0]._id,
          requestId: requests[0]._id,
          pickupLocation: airportLocation,
          pickupAddress: 'San Francisco International Airport',
          dropoffLocation: {
            type: 'Point',
            coordinates: destinations[0].coordinates
          },
          dropoffAddress: destinations[0].address,
          price: 25.50,
          passengerCount: 2,
          luggageCount: 3,
          status: 'waiting'
        },
        {
          userId: users[1]._id,
          requestId: requests[1]._id,
          pickupLocation: airportLocation,
          pickupAddress: 'San Francisco International Airport',
          dropoffLocation: {
            type: 'Point',
            coordinates: destinations[1].coordinates
          },
          dropoffAddress: destinations[1].address,
          price: 22.75,
          passengerCount: 1,
          luggageCount: 2,
          status: 'waiting'
        }
      ],
      route: {
        stops: [
          {
            type: 'pickup',
            location: airportLocation,
            address: 'San Francisco International Airport',
            passengerId: users[0]._id,
            sequence: 0
          },
          {
            type: 'pickup',
            location: airportLocation,
            address: 'San Francisco International Airport',
            passengerId: users[1]._id,
            sequence: 1
          },
          {
            type: 'dropoff',
            location: {
              type: 'Point',
              coordinates: destinations[0].coordinates
            },
            address: destinations[0].address,
            passengerId: users[0]._id,
            sequence: 2
          },
          {
            type: 'dropoff',
            location: {
              type: 'Point',
              coordinates: destinations[1].coordinates
            },
            address: destinations[1].address,
            passengerId: users[1]._id,
            sequence: 3
          }
        ],
        totalDistance: 28.5,
        totalDuration: 42,
        optimizedAt: new Date()
      },
      vehicle: {
        type: 'sedan',
        capacity: 4,
        luggageCapacity: 6
      },
      currentOccupancy: {
        seats: 3,
        luggage: 5
      },
      pricing: {
        basePrice: 50.00,
        surgeFactor: 1.2,
        totalPrice: 48.25,
        poolingDiscount: 0.20
      },
      matchedAt: new Date()
    });

    logger.info(`Created ride pool with ID: ${pool._id}`);

    // Summary
    logger.info('\n=== Seed Data Summary ===');
    logger.info(`Users created: ${users.length}`);
    logger.info(`Ride requests created: ${requests.length}`);
    logger.info(`Ride pools created: 1`);
    logger.info('\n=== Test Credentials ===');
    users.forEach(user => {
      logger.info(`Email: ${user.email} | Password: password123`);
    });
    logger.info('========================\n');

    logger.info('Database seeded successfully!');
    process.exit(0);

  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();