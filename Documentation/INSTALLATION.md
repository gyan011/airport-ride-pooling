# Installation Guide

## Prerequisites Installation

### 1. Install Node.js (v18 or higher)

#### macOS
```bash
# Using Homebrew
brew install node

# Or download from https://nodejs.org/
```

#### Ubuntu/Debian
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs
```

#### Windows
Download and install from [https://nodejs.org/](https://nodejs.org/)

### 2. Install MongoDB

#### macOS
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB
brew services start mongodb-community@7.0
```

#### Ubuntu/Debian
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -sc)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Windows
Download and install from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)

### 3. Install Redis

#### macOS
```bash
# Using Homebrew
brew install redis

# Start Redis
brew services start redis
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Windows
Download from [https://redis.io/download](https://redis.io/download) or use WSL

---

## Project Setup

### Method 1: Automated Setup (Recommended)

#### Linux/macOS
```bash
# Make setup script executable
chmod +x setup.sh

# Run setup
./setup.sh
```

#### Windows
```cmd
# Run setup script
setup.bat
```

### Method 2: Manual Setup

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use any text editor
```

3. **Create logs directory**
```bash
mkdir -p logs
```

4. **Verify services**
```bash
# Check MongoDB
mongosh --eval "db.runCommand({ ping: 1 })"

# Check Redis
redis-cli ping
```

---

## Running the Application

### 1. Seed the Database (First Time Only)
```bash
npm run seed
```

This creates test users and sample data.

### 2. Start the Server

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

### 3. Verify It's Running
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-02-16T10:30:00.000Z",
  "uptime": 5.123,
  "environment": "development"
}
```

---

## Alternative: Docker Setup (No Prerequisites Needed!)

If you have Docker installed, you can skip all the above and just run:

```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

---

## Testing the Setup

### Quick API Test

1. **Register a user**
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

2. **Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copy the token from the response!

3. **Create a ride**
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

### Using Postman

1. Import the collection from `docs/postman-collection.json`
2. Use the "Login" request to get a token
3. The token will be automatically saved for other requests
4. Try the various endpoints!

---

## Troubleshooting

### MongoDB Connection Error
```bash
# Check if MongoDB is running
sudo systemctl status mongod  # Linux
brew services list             # macOS

# Try connecting manually
mongosh

# Start if not running
sudo systemctl start mongod    # Linux
brew services start mongodb-community  # macOS
```

### Redis Connection Error
```bash
# Check if Redis is running
redis-cli ping

# If not running
sudo systemctl start redis-server  # Linux
brew services start redis          # macOS
```

### Port 3000 Already in Use
```bash
# Find what's using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Either kill that process or change PORT in .env
echo "PORT=3001" >> .env
```

### Dependencies Installation Failed
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Permission Denied Errors (Linux/macOS)
```bash
# Fix permissions
sudo chown -R $USER:$USER .
chmod +x setup.sh
```

---

## Environment Variables

Key variables you may want to customize in `.env`:

```env
# Server
PORT=3000                       # Server port
NODE_ENV=development            # Environment

# Database
MONGODB_URI=mongodb://localhost:27017/airport-ride-pooling

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change-this-in-production  # IMPORTANT: Change this!
JWT_EXPIRE=24h

# Ride Settings
MAX_POOL_SIZE=4                 # Max passengers per cab
DEFAULT_DETOUR_TOLERANCE=0.3    # 30% max detour
MATCHING_RADIUS_KM=5            # 5 km matching radius

# Pricing
BASE_RATE_PER_KM=2.0
BASE_RATE_PER_MIN=0.5
MINIMUM_FARE=5.0
```

---

## Next Steps

1. ✅ Complete installation
2. ✅ Start the server
3. ✅ Test with Postman or curl
4. 📖 Read the API documentation: `docs/API_DOCUMENTATION.md`
5. 🏗️ Review system design: `docs/SYSTEM_DESIGN.md`
6. 🧪 Run tests: `npm test`

---

## Support

- Check `README.md` for comprehensive documentation
- See `QUICKSTART.md` for quick start guide
- Review `docs/API_DOCUMENTATION.md` for API details
- Read `docs/SYSTEM_DESIGN.md` for architecture

**Happy coding! 🚀**