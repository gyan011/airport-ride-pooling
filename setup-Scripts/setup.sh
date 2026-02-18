#!/bin/bash

# Airport Ride Pooling - Setup Script
# This script will set up the entire project automatically

set -e  # Exit on error

echo "🚀 Setting up Airport Ride Pooling Backend System..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current: $(node -v)"
    exit 1
fi
print_success "Node.js version: $(node -v)"

# Check npm
print_info "Checking npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi
print_success "npm version: $(npm -v)"

# Install dependencies
print_info "Installing dependencies..."
npm install --silent
print_success "Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_success ".env file created"
    echo ""
    print_info "⚠️  Please edit .env file with your configuration"
    print_info "   - Set JWT_SECRET to a secure random string"
    print_info "   - Configure MongoDB and Redis connections if needed"
    echo ""
else
    print_success ".env file already exists"
fi

# Create logs directory
print_info "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Check MongoDB
print_info "Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.runCommand({ ping: 1 })" --quiet > /dev/null 2>&1; then
        print_success "MongoDB is running"
    else
        print_error "MongoDB is not running or not accessible"
        print_info "Start MongoDB with: sudo systemctl start mongod (Linux) or brew services start mongodb-community (macOS)"
        exit 1
    fi
else
    print_error "mongosh not found. Cannot verify MongoDB connection."
    print_info "Make sure MongoDB is installed and running"
fi

# Check Redis
print_info "Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is running"
    else
        print_error "Redis is not running or not accessible"
        print_info "Start Redis with: sudo systemctl start redis (Linux) or brew services start redis (macOS)"
        exit 1
    fi
else
    print_error "redis-cli not found. Cannot verify Redis connection."
    print_info "Make sure Redis is installed and running"
fi

echo ""
print_success "Setup complete! 🎉"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo ""
echo "1. Seed the database with test data:"
echo "   npm run seed"
echo ""
echo "2. Start the server:"
echo "   npm run dev"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "4. Import Postman collection from:"
echo "   docs/postman-collection.json"
echo ""
echo "📖 Documentation:"
echo "   - README.md - Complete guide"
echo "   - QUICKSTART.md - Quick start guide"
echo "   - docs/API_DOCUMENTATION.md - API reference"
echo "   - docs/SYSTEM_DESIGN.md - System design"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"