# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Authentication

#### 1.1 Register User
Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "phone": "+11234567890",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "phone": "+11234567890",
      "name": "John Doe",
      "tier": "basic",
      "preferences": {
        "detourTolerance": 0.3,
        "maxWaitTime": 10
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 1.2 Login
Authenticate and receive a JWT token.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 1.3 Get Profile
Get current user's profile.

**Endpoint:** `GET /auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "John Doe",
      "tier": "basic",
      "totalRides": 15,
      "rating": 4.8
    }
  }
}
```

#### 1.4 Update Preferences
Update user preferences for ride matching.

**Endpoint:** `PUT /auth/preferences`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "detourTolerance": 0.25,
  "maxWaitTime": 15,
  "preferredVehicleType": "suv"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

---

### 2. Ride Management

#### 2.1 Create Ride Request
Request a new ride from airport to destination.

**Endpoint:** `POST /rides/request`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "pickupLocation": {
    "coordinates": [-122.3789, 37.6213]
  },
  "pickupAddress": "San Francisco International Airport, Terminal 1",
  "dropoffLocation": {
    "coordinates": [-122.4194, 37.7749]
  },
  "dropoffAddress": "123 Market St, San Francisco, CA 94103",
  "passengers": 2,
  "luggage": 3,
  "detourTolerance": 0.3
}
```

**Field Descriptions:**
- `pickupLocation.coordinates`: [longitude, latitude] in decimal degrees
- `passengers`: Number of passengers (1-4)
- `luggage`: Number of luggage items (0-6)
- `detourTolerance`: Acceptable detour percentage (0-1, e.g., 0.3 = 30%)

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "requestId": "507f1f77bcf86cd799439011",
    "poolId": "507f1f77bcf86cd799439012",
    "isNewPool": false,
    "estimatedPrice": 28.50,
    "detour": 0.15,
    "status": "matched"
  }
}
```

**Response Fields:**
- `isNewPool`: `true` if a new pool was created, `false` if joined existing pool
- `estimatedPrice`: Price in USD for this passenger
- `detour`: Actual detour percentage (0-1)

#### 2.2 Get Price Estimate
Get price estimate before booking.

**Endpoint:** `POST /rides/price-estimate`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "pickupLocation": {
    "coordinates": [-122.3789, 37.6213]
  },
  "dropoffLocation": {
    "coordinates": [-122.4194, 37.7749]
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "soloPrice": 45.50,
    "pooledPrice": 32.75,
    "estimatedDistance": 22.5,
    "estimatedDuration": 35,
    "demandLevel": "normal",
    "surgeFactor": 1.2
  }
}
```

#### 2.3 Get Ride Pool Details
Get details of a specific ride pool.

**Endpoint:** `GET /rides/pool/:poolId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pool": {
      "_id": "507f1f77bcf86cd799439012",
      "status": "active",
      "passengers": [
        {
          "userId": {
            "_id": "507f1f77bcf86cd799439011",
            "name": "John Doe",
            "phone": "+11234567890"
          },
          "pickupAddress": "San Francisco International Airport",
          "dropoffAddress": "123 Market St",
          "price": 28.50,
          "status": "waiting"
        }
      ],
      "route": {
        "stops": [
          {
            "type": "pickup",
            "address": "San Francisco International Airport",
            "sequence": 0,
            "estimatedTime": "2024-02-16T10:30:00.000Z"
          },
          {
            "type": "dropoff",
            "address": "123 Market St",
            "sequence": 1,
            "estimatedTime": "2024-02-16T11:05:00.000Z"
          }
        ],
        "totalDistance": 22.5,
        "totalDuration": 35
      },
      "vehicle": {
        "type": "sedan",
        "capacity": 4,
        "luggageCapacity": 6
      },
      "currentOccupancy": {
        "seats": 2,
        "luggage": 3
      }
    }
  }
}
```

#### 2.4 Get Active Rides
Get all active rides for the current user.

**Endpoint:** `GET /rides/active`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "status": "active",
        "passengers": [ ... ],
        "route": { ... }
      }
    ]
  }
}
```

#### 2.5 Get Ride History
Get paginated ride history for the current user.

**Endpoint:** `GET /rides/history?page=1&limit=10`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "rides": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

#### 2.6 Cancel Ride
Cancel participation in a ride pool.

**Endpoint:** `DELETE /rides/pool/:poolId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Ride cancelled successfully",
    "pool": { ... }
  }
}
```

#### 2.7 Get Pool Statistics
Get statistics about ride pools (last 24 hours).

**Endpoint:** `GET /rides/stats`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "_id": "active",
        "count": 15,
        "avgPassengers": 2.5,
        "avgDistance": 18.2
      },
      {
        "_id": "completed",
        "count": 87,
        "avgPassengers": 2.8,
        "avgDistance": 20.5
      }
    ]
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Validation Error Example

```json
{
  "success": false,
  "errors": [
    {
      "field": "passengers",
      "message": "Must be between 1 and 4"
    },
    {
      "field": "luggage",
      "message": "Must be between 0 and 6"
    }
  ]
}
```

---

## Rate Limiting

- **Limit:** 100 requests per second per IP
- **Window:** 1 second
- **Response when exceeded:** HTTP 429

```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

---

## Coordinates Format

All location coordinates use the GeoJSON format:
- **Format:** `[longitude, latitude]`
- **Example:** `[-122.4194, 37.7749]`
- **Longitude range:** -180 to 180
- **Latitude range:** -90 to 90

---

## Example: Complete Ride Request Flow

### 1. Register/Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 2. Get Price Estimate
```bash
curl -X POST http://localhost:3000/api/rides/price-estimate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {"coordinates": [-122.3789, 37.6213]},
    "dropoffLocation": {"coordinates": [-122.4194, 37.7749]}
  }'
```

### 3. Create Ride Request
```bash
curl -X POST http://localhost:3000/api/rides/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {"coordinates": [-122.3789, 37.6213]},
    "pickupAddress": "SFO Airport",
    "dropoffLocation": {"coordinates": [-122.4194, 37.7749]},
    "dropoffAddress": "123 Market St",
    "passengers": 2,
    "luggage": 3,
    "detourTolerance": 0.3
  }'
```

### 4. Check Active Rides
```bash
curl -X GET http://localhost:3000/api/rides/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Get Pool Details
```bash
curl -X GET http://localhost:3000/api/rides/pool/POOL_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## WebSocket Events (Future Enhancement)

Real-time updates will be available via WebSocket:

- `pool:updated` - Pool details changed
- `pool:matched` - New passenger joined
- `ride:started` - Ride started
- `ride:completed` - Ride completed
- `driver:location` - Driver location update

---

## Testing with Postman

Import the Postman collection from `docs/postman-collection.json` for easy API testing.