# Smart Airport Ride Pooling System - Complete Design Document

## 1. DSA Approach with Complexity Analysis

### 1.1 Core Algorithms

#### **Ride Matching Algorithm**
```
Algorithm: Greedy + Spatial Clustering with Constraint Satisfaction

Step 1: Spatial Clustering O(n log n)
- Use R-tree or Geohashing for spatial indexing
- Group requests within proximity threshold
- Complexity: O(n log n) for initial clustering

Step 2: Constraint-Based Matching O(k²) where k = cluster size
- For each cluster, apply constraints:
  * Seat capacity: seats_used + new_request.passengers <= cab_capacity
  * Luggage capacity: luggage_used + new_request.luggage <= luggage_limit
  * Detour tolerance: calculate_detour(route, new_point) <= tolerance
- Use greedy approach to maximize matches

Step 3: Route Optimization O(k!)
- For small groups (k ≤ 8): Use dynamic programming TSP variant
- For larger groups: Use nearest neighbor heuristic
- Complexity: O(k!) for exact, O(k²) for heuristic
```

**Overall Time Complexity**: O(n log n) + O(k² * m) where:
- n = total requests
- k = average cluster size (typically 4-8)
- m = number of clusters

**Space Complexity**: O(n) for storing requests and spatial indices

#### **Detour Calculation Algorithm**
```javascript
function calculateDetour(currentRoute, newPickup, newDropoff) {
    // Original distance
    const originalDistance = sum(distances between consecutive points in route);
    
    // Try all insertion positions for pickup and dropoff
    let minDetour = Infinity;
    
    for (let i = 0; i <= route.length; i++) {
        for (let j = i; j <= route.length; j++) {
            const newRoute = insertPoints(route, newPickup, i, newDropoff, j);
            const newDistance = calculateRouteDistance(newRoute);
            const detour = (newDistance - originalDistance) / originalDistance;
            
            if (detour < minDetour) {
                minDetour = detour;
            }
        }
    }
    
    return minDetour;
}
```
**Complexity**: O(k²) for k stops in route

#### **Real-time Cancellation Handling**
```
Algorithm: Event-Driven State Machine

1. Receive cancellation event: O(1)
2. Lock ride pool: O(1) using distributed lock (Redis)
3. Update ride state: O(1)
4. Recompute route if needed: O(k²)
5. Notify affected passengers: O(k) via WebSocket
6. Release lock: O(1)

Total: O(k²) per cancellation
```

### 1.2 Data Structures

**Priority Queue for Request Matching**
- Use min-heap based on timestamp + detour penalty
- Insert: O(log n)
- Extract-min: O(log n)
- Used for processing requests in optimal order

**R-tree for Spatial Indexing**
- Query nearby requests: O(log n + k)
- Insert new request: O(log n)
- Better than grid-based for non-uniform distribution

**Graph for Route Optimization**
- Adjacency list representation
- Dijkstra's for shortest path: O(E log V)
- Used for calculating actual road distances

---

## 2. Low Level Design

### 2.1 Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RidePoolingSystem                        │
├─────────────────────────────────────────────────────────────┤
│ - matchingEngine: MatchingEngine                            │
│ - pricingEngine: PricingEngine                              │
│ - routeOptimizer: RouteOptimizer                            │
├─────────────────────────────────────────────────────────────┤
│ + processRideRequest(request: RideRequest): RideResponse    │
│ + cancelRide(rideId: string): CancellationResult            │
│ + getRideStatus(rideId: string): RideStatus                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MatchingEngine                         │
├─────────────────────────────────────────────────────────────┤
│ - spatialIndex: SpatialIndex                                │
│ - constraintValidator: ConstraintValidator                  │
│ - requestQueue: PriorityQueue<RideRequest>                  │
├─────────────────────────────────────────────────────────────┤
│ + findMatchingPool(request: RideRequest): RidePool?         │
│ + createNewPool(request: RideRequest): RidePool             │
│ + addToPool(pool: RidePool, request: RideRequest): boolean  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ collaborates
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    RouteOptimizer                           │
├─────────────────────────────────────────────────────────────┤
│ - distanceCalculator: DistanceCalculator                    │
│ - routeCache: LRUCache<Route>                               │
├─────────────────────────────────────────────────────────────┤
│ + optimizeRoute(stops: Stop[]): Route                       │
│ + calculateDetour(route: Route, newStop: Stop): number      │
│ + isWithinTolerance(detour: number, tolerance: number): bool│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     RidePool (Entity)                       │
├─────────────────────────────────────────────────────────────┤
│ - id: string                                                │
│ - passengers: Passenger[]                                   │
│ - route: Route                                              │
│ - vehicle: Vehicle                                          │
│ - status: PoolStatus                                        │
│ - currentSeats: number                                      │
│ - currentLuggage: number                                    │
│ - createdAt: Date                                           │
├─────────────────────────────────────────────────────────────┤
│ + canAccommodate(request: RideRequest): boolean             │
│ + addPassenger(passenger: Passenger): void                  │
│ + removePassenger(passengerId: string): void                │
│ + updateRoute(newRoute: Route): void                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  RideRequest (Value Object)                 │
├─────────────────────────────────────────────────────────────┤
│ - userId: string                                            │
│ - pickupLocation: GeoPoint                                  │
│ - dropoffLocation: GeoPoint                                 │
│ - passengers: number                                        │
│ - luggage: number                                           │
│ - detourTolerance: number                                   │
│ - timestamp: Date                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PricingEngine                            │
├─────────────────────────────────────────────────────────────┤
│ - basePricing: BasePricingConfig                            │
│ - demandMultiplier: DemandMultiplier                        │
├─────────────────────────────────────────────────────────────┤
│ + calculatePrice(ride: RidePool, passenger: Passenger): Price│
│ + applyDynamicPricing(basePrice: number, factors: Factor[]): number│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Design Patterns Used

#### **1. Strategy Pattern**
- **Where**: Pricing calculation, Route optimization
- **Why**: Multiple algorithms for pricing (surge, discount, flat) and routing (TSP, greedy)
```javascript
class PricingStrategy {
    calculatePrice(rideData) {}
}

class SurgePricingStrategy extends PricingStrategy {
    calculatePrice(rideData) {
        // Surge pricing logic
    }
}
```

#### **2. Observer Pattern**
- **Where**: Real-time notifications, ride status updates
- **Why**: Multiple listeners need to react to ride state changes
```javascript
class RidePool extends EventEmitter {
    updateStatus(newStatus) {
        this.status = newStatus;
        this.emit('statusChanged', this);
    }
}
```

#### **3. Repository Pattern**
- **Where**: Data access layer
- **Why**: Abstract database operations, enable testing
```javascript
class RidePoolRepository {
    async findById(id) {}
    async save(ridePool) {}
    async findNearby(location, radius) {}
}
```

#### **4. Factory Pattern**
- **Where**: Creating ride pools, requests
- **Why**: Complex object creation with validation
```javascript
class RidePoolFactory {
    createPool(request) {
        // Validation and initialization logic
    }
}
```

#### **5. Singleton Pattern**
- **Where**: Matching engine, connection pools
- **Why**: Single instance needed for coordination

#### **6. Command Pattern**
- **Where**: Request handling, cancellations
- **Why**: Queue operations, undo support for cancellations

---

## 3. High Level Architecture

```
                          ┌─────────────────┐
                          │   API Gateway   │
                          │   (Rate Limit)  │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
            │  Auth        │ │  Ride    │ │  Payment   │
            │  Service     │ │  Service │ │  Service   │
            └──────────────┘ └────┬─────┘ └────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │                           │
            ┌───────▼────────┐         ┌───────▼────────┐
            │   Matching     │         │     Route      │
            │   Engine       │◄────────┤   Optimizer    │
            │  (Node.js)     │         │   (Node.js)    │
            └───────┬────────┘         └────────────────┘
                    │
                    │
        ┌───────────┼───────────────────────────┐
        │           │                           │
┌───────▼──────┐ ┌─▼────────────┐    ┌────────▼────────┐
│   Redis      │ │   MongoDB    │    │   PostgreSQL    │
│   (Cache +   │ │  (Rides,     │    │  (Transactions, │
│    Locks)    │ │   Users)     │    │    Analytics)   │
└──────────────┘ └──────────────┘    └─────────────────┘

┌──────────────────────────────────────────────────────────┐
│             Message Queue (RabbitMQ/Kafka)               │
│  - Ride matching events                                  │
│  - Cancellation events                                   │
│  - Notification events                                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           WebSocket Server (Socket.io)                   │
│  - Real-time ride updates                                │
│  - Driver location tracking                              │
│  - Live notifications                                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              External Services                           │
│  - Google Maps API (routing, distance)                   │
│  - Payment Gateway                                       │
│  - SMS/Email Service                                     │
└──────────────────────────────────────────────────────────┘
```

### Architecture Layers:

1. **API Layer**: Express.js with rate limiting, authentication
2. **Service Layer**: Business logic, matching engine
3. **Data Layer**: MongoDB (primary), Redis (cache), PostgreSQL (analytics)
4. **Message Layer**: Event-driven communication
5. **Real-time Layer**: WebSocket for live updates

---

## 4. Concurrency Handling Strategy

### 4.1 Distributed Locking (Redis)

```javascript
class RidePoolLock {
    async acquireLock(poolId, timeout = 5000) {
        const lockKey = `lock:pool:${poolId}`;
        const lockValue = uuidv4();
        
        const acquired = await redis.set(
            lockKey, 
            lockValue, 
            'PX', timeout, 
            'NX'
        );
        
        return acquired ? lockValue : null;
    }
    
    async releaseLock(poolId, lockValue) {
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;
        await redis.eval(script, 1, `lock:pool:${poolId}`, lockValue);
    }
}
```

### 4.2 Optimistic Locking (MongoDB)

```javascript
const ridePoolSchema = new Schema({
    version: { type: Number, default: 0 },
    // ... other fields
});

async function updateRidePool(poolId, updates) {
    const result = await RidePool.findOneAndUpdate(
        { _id: poolId, version: currentVersion },
        { 
            $set: updates,
            $inc: { version: 1 }
        },
        { new: true }
    );
    
    if (!result) {
        throw new ConcurrencyError('Pool was modified by another process');
    }
    
    return result;
}
```

### 4.3 Message Queue for Async Processing

```javascript
// Producer
async function requestRide(rideRequest) {
    await channel.sendToQueue('ride-matching-queue', 
        Buffer.from(JSON.stringify(rideRequest)),
        { persistent: true }
    );
}

// Consumer (multiple workers)
channel.consume('ride-matching-queue', async (msg) => {
    const request = JSON.parse(msg.content);
    await matchingEngine.process(request);
    channel.ack(msg);
}, { prefetch: 10 });
```

### 4.4 Connection Pooling

```javascript
// MongoDB connection pool
const mongoOptions = {
    maxPoolSize: 100,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000
};

// Redis connection pool
const redisPool = createPool({
    create: () => redis.createClient(),
    destroy: (client) => client.quit(),
    max: 50,
    min: 10
});
```

### 4.5 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 100, // 100 requests per second
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests, please try again later'
        });
    }
});
```

---

## 5. Database Schema and Indexing Strategy

### 5.1 MongoDB Schemas

#### **Users Collection**
```javascript
{
    _id: ObjectId,
    email: String,
    phone: String,
    name: String,
    createdAt: Date,
    preferences: {
        detourTolerance: Number,
        maxWaitTime: Number
    }
}

Indexes:
- { email: 1 } - unique
- { phone: 1 } - unique
```

#### **RidePools Collection**
```javascript
{
    _id: ObjectId,
    status: String, // 'forming', 'active', 'completed', 'cancelled'
    passengers: [{
        userId: ObjectId,
        pickupLocation: {
            type: 'Point',
            coordinates: [lng, lat]
        },
        dropoffLocation: {
            type: 'Point',
            coordinates: [lng, lat]
        },
        pickupTime: Date,
        dropoffTime: Date,
        price: Number,
        status: String
    }],
    route: {
        stops: [{
            type: String, // 'pickup' or 'dropoff'
            location: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            passengerId: ObjectId,
            sequence: Number,
            estimatedTime: Date
        }],
        totalDistance: Number,
        totalDuration: Number
    },
    vehicle: {
        type: String,
        capacity: Number,
        luggageCapacity: Number
    },
    currentOccupancy: {
        seats: Number,
        luggage: Number
    },
    pricing: {
        basePrice: Number,
        surgeFactor: Number,
        totalPrice: Number
    },
    version: Number,
    createdAt: Date,
    updatedAt: Date
}

Indexes:
- { status: 1, createdAt: -1 }
- { 'passengers.userId': 1 }
- { 'route.stops.location': '2dsphere' } - Geospatial index
- { status: 1, currentOccupancy.seats: 1 } - Compound for matching
- { createdAt: -1 } - TTL for old records
```

#### **RideRequests Collection** (Temporary queue)
```javascript
{
    _id: ObjectId,
    userId: ObjectId,
    pickupLocation: {
        type: 'Point',
        coordinates: [lng, lat],
        address: String
    },
    dropoffLocation: {
        type: 'Point',
        coordinates: [lng, lat],
        address: String
    },
    passengers: Number,
    luggage: Number,
    detourTolerance: Number,
    requestedTime: Date,
    status: String, // 'pending', 'matched', 'expired'
    matchedPoolId: ObjectId,
    expiresAt: Date
}

Indexes:
- { pickupLocation: '2dsphere' } - Geospatial for nearby requests
- { status: 1, requestedTime: 1 }
- { expiresAt: 1 } - TTL index (auto-delete expired)
- { userId: 1, status: 1 }
```

### 5.2 PostgreSQL Schema (Analytics & Transactions)

```sql
-- Completed rides for analytics
CREATE TABLE completed_rides (
    id UUID PRIMARY KEY,
    pool_id VARCHAR(24),
    user_id VARCHAR(24),
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    dropoff_lat DECIMAL(10, 8),
    dropoff_lng DECIMAL(11, 8),
    actual_distance DECIMAL(10, 2),
    actual_duration INTEGER,
    price DECIMAL(10, 2),
    detour_percentage DECIMAL(5, 2),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_completed_rides_user ON completed_rides(user_id, completed_at);
CREATE INDEX idx_completed_rides_time ON completed_rides(completed_at);
CREATE INDEX idx_completed_rides_location ON completed_rides USING GIST (
    ll_to_earth(pickup_lat, pickup_lng)
);

-- Pricing history
CREATE TABLE pricing_snapshots (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100),
    surge_factor DECIMAL(4, 2),
    demand_level INTEGER,
    active_rides INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pricing_region_time ON pricing_snapshots(region, timestamp);
```

### 5.3 Redis Data Structures

```
# Active pools cache (Hash)
Key: pool:{poolId}
Value: JSON of RidePool
TTL: 1 hour

# Geospatial index for active pools
Key: geo:active-pools
Type: GEOHASH
Commands: GEOADD, GEORADIUS

# Rate limiting
Key: ratelimit:{userId}:{endpoint}
Type: String (counter)
TTL: 1 second

# Distributed locks
Key: lock:pool:{poolId}
Type: String
TTL: 5 seconds

# Real-time demand tracking
Key: demand:{region}:{timeslot}
Type: Sorted Set
Score: timestamp
```

---

## 6. Dynamic Pricing Formula

### 6.1 Base Price Calculation

```javascript
function calculateBasePrice(distance, duration) {
    const BASE_RATE = 2.0; // $ per km
    const TIME_RATE = 0.5; // $ per minute
    const MINIMUM_FARE = 5.0;
    
    const distancePrice = distance * BASE_RATE;
    const timePrice = duration * TIME_RATE;
    
    return Math.max(distancePrice + timePrice, MINIMUM_FARE);
}
```

### 6.2 Dynamic Multipliers

```javascript
function calculateDynamicPrice(basePrice, factors) {
    let finalPrice = basePrice;
    
    // 1. Surge Pricing (Demand-based)
    const demandMultiplier = calculateDemandMultiplier(
        factors.activeRequests,
        factors.availableCabs
    );
    finalPrice *= demandMultiplier;
    
    // 2. Time-of-day Multiplier
    const timeMultiplier = getTimeMultiplier(factors.currentHour);
    finalPrice *= timeMultiplier;
    
    // 3. Pooling Discount
    const poolingDiscount = calculatePoolingDiscount(
        factors.passengersInPool,
        factors.detourPercentage
    );
    finalPrice *= (1 - poolingDiscount);
    
    // 4. Distance-based Discount
    if (factors.distance > 20) {
        finalPrice *= 0.9; // 10% discount for long trips
    }
    
    // 5. Loyalty Discount
    if (factors.userTier === 'premium') {
        finalPrice *= 0.95;
    }
    
    return Math.round(finalPrice * 100) / 100;
}

function calculateDemandMultiplier(activeRequests, availableCabs) {
    const ratio = activeRequests / Math.max(availableCabs, 1);
    
    if (ratio < 0.5) return 1.0;      // Low demand
    if (ratio < 1.0) return 1.2;      // Normal demand
    if (ratio < 1.5) return 1.5;      // High demand
    if (ratio < 2.0) return 2.0;      // Very high demand
    return 2.5;                        // Surge pricing
}

function getTimeMultiplier(hour) {
    if (hour >= 6 && hour < 9) return 1.3;   // Morning rush
    if (hour >= 17 && hour < 20) return 1.4; // Evening rush
    if (hour >= 0 && hour < 6) return 1.2;   // Late night
    return 1.0; // Normal hours
}

function calculatePoolingDiscount(passengersCount, detourPercentage) {
    // More passengers = more discount
    const baseDiscount = Math.min(passengersCount * 0.15, 0.45);
    
    // Less detour = more discount
    const detourPenalty = detourPercentage * 0.01;
    
    return Math.max(baseDiscount - detourPenalty, 0.1);
}
```

### 6.3 Complete Pricing Formula

```
Final Price = Base Price 
              × Demand Multiplier 
              × Time Multiplier 
              × (1 - Pooling Discount)
              × Distance Discount Factor
              × Loyalty Factor
              + Airport Fee (if applicable)
              + Toll Charges (if applicable)

Where:
- Base Price = (Distance × $2/km) + (Duration × $0.5/min)
- Demand Multiplier = f(active_requests / available_cabs) ∈ [1.0, 2.5]
- Time Multiplier ∈ {1.0, 1.2, 1.3, 1.4}
- Pooling Discount ∈ [10%, 45%]
- Distance Factor = 0.9 if distance > 20km, else 1.0
- Loyalty Factor = 0.95 for premium users, else 1.0
```

### 6.4 Price Fairness Algorithm

```javascript
function ensureFairPricing(passengers, totalPrice) {
    // Each passenger pays based on their individual distance
    // But total shouldn't exceed what they'd pay individually
    
    const individualPrices = passengers.map(p => 
        calculateBasePrice(p.individualDistance, p.individualDuration)
    );
    
    const maxIndividualTotal = individualPrices.reduce((a, b) => a + b, 0);
    
    if (totalPrice > maxIndividualTotal) {
        totalPrice = maxIndividualTotal * 0.9; // 10% pool discount
    }
    
    // Distribute proportionally
    return passengers.map((p, i) => ({
        passengerId: p.id,
        price: (individualPrices[i] / maxIndividualTotal) * totalPrice
    }));
}
```

---

## 7. Performance Optimizations

### 7.1 Caching Strategy
- Redis cache for active pools (TTL: 5 minutes)
- Route calculation results cached (TTL: 1 hour)
- User preferences cached (TTL: 30 minutes)

### 7.2 Database Optimizations
- Compound indexes for common query patterns
- Read replicas for analytics queries
- Sharding strategy for high-volume collections

### 7.3 API Optimizations
- Response compression (gzip)
- Pagination for list endpoints
- Field projection to reduce payload size

### 7.4 Scaling Strategy
- Horizontal scaling with load balancer
- Microservices for matching engine
- CDN for static assets
- Database connection pooling

---

## 8. Monitoring and Observability

### Key Metrics to Track:
1. **Performance**: p50, p95, p99 latencies
2. **Business**: Match rate, average pool size, revenue
3. **System**: CPU, memory, database connections
4. **Errors**: Failed matches, timeout rates

### Tools:
- Prometheus + Grafana for metrics
- ELK Stack for logging
- New Relic/DataDog for APM
- Sentry for error tracking