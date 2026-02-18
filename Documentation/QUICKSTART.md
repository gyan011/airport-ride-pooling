# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Option 1: Using Docker (Recommended)

1. **Start services**
   ```bash
   docker-compose up -d
   ```

2. **Verify services are running**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Create test data**
   ```bash
   docker-compose exec app npm run seed
   ```

4. **Done!** API is now available at `http://localhost:3000/api`

### Option 2: Local Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start MongoDB and Redis**
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   brew services start redis
   
   # Ubuntu/Linux
   sudo systemctl start mongod
   sudo systemctl start redis-server
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env if needed
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

5. **Create test data**
   ```bash
   npm run seed
   ```

## 📝 Test the API

### 1. Register a user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+11234567890",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login and get token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Copy the token from the response!**

### 3. Create a ride request
```bash
curl -X POST http://localhost:3000/api/rides/request \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {"coordinates": [-122.3789, 37.6213]},
    "pickupAddress": "San Francisco Airport",
    "dropoffLocation": {"coordinates": [-122.4194, 37.7749]},
    "dropoffAddress": "Downtown SF",
    "passengers": 2,
    "luggage": 2,
    "detourTolerance": 0.3
  }'
```

## 🧪 Using Postman

1. Import `docs/postman-collection.json` into Postman
2. Login using the "Login" request
3. The token will be automatically saved
4. Try other requests!

## 📊 Using Seeded Data

After running `npm run seed`, you can login with these test accounts:

```
Email: john.doe@example.com
Password: password123

Email: jane.smith@example.com  
Password: password123

Email: bob.wilson@example.com
Password: password123
```

## 🔍 Troubleshooting

**MongoDB not connecting?**
```bash
# Check if MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"
```

**Redis not connecting?**
```bash
# Check if Redis is running
redis-cli ping
```

**Port 3000 already in use?**
```bash
# Change PORT in .env file
PORT=3001
```

## 📖 Next Steps

- Read the full [README.md](README.md)
- Check [API Documentation](docs/API_DOCUMENTATION.md)
- Review [System Design](docs/SYSTEM_DESIGN.md)
- Run tests: `npm test`

---

**Happy coding! 🎉**