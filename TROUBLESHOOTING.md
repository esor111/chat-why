# Troubleshooting Guide

## 🔍 Quick Diagnostics

Run these commands to identify issues:

```bash
# Check for compilation errors
npm run check:errors

# Check Node.js version compatibility
npm run check:node

# Validate setup
npm run validate-setup

# Test JWT token
npm run test:jwt

# Test database connections
npm run setup:host
```

## 🚨 Common Errors and Solutions

### 1. Database Connection Errors

**Error**: `ECONNREFUSED` or `Connection refused`

**Solutions**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
# or on macOS
brew services list | grep postgresql

# Start PostgreSQL if not running
sudo systemctl start postgresql
# or on macOS
brew services start postgresql

# Test connection manually
psql -h localhost -U root -d chat-meaw

# Create database if it doesn't exist
createdb chat-meaw
createuser root --password  # password: root
```

### 2. Redis Connection Errors

**Error**: `Redis connection failed`

**Solutions**:
```bash
# Check if Redis is running
sudo systemctl status redis
# or on macOS
brew services list | grep redis

# Start Redis if not running
sudo systemctl start redis
# or on macOS
brew services start redis
# or manually
redis-server

# Test Redis connection
redis-cli ping
```

### 3. TypeScript Compilation Errors

**Error**: `Cannot find module` or `Type errors`

**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for specific errors
npm run check:errors

# Try building
npm run build
```

### 4. JWT Token Issues

**Error**: `Invalid token` or `Unauthorized`

**Solutions**:
```bash
# Test your token
npm run test:jwt

# Check JWT_SECRET in .env file
# Make sure it matches: JWT_SECRET=secret
```

### 5. Migration Errors

**Error**: `Migration failed` or `Table already exists`

**Solutions**:
```bash
# Check current migration status
npm run typeorm migration:show

# Revert last migration if needed
npm run migration:revert

# Run migrations again
npm run migration:run

# If all else fails, reset database (WARNING: destroys data)
dropdb chat-meaw
createdb chat-meaw
npm run migration:run
```

### 6. Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run start:dev
```

### 7. Module Resolution Errors

**Error**: `Cannot resolve dependency` or `Circular dependency`

**Solutions**:
```bash
# Check for circular dependencies
npm run check:errors

# Clear TypeScript cache
rm -rf dist/
npx tsc --build --clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 8. TypeScript Decorator Errors (Node.js v23+ Compatibility)

**Error**: `Unable to resolve signature of property decorator` or `TS1240` errors

**Root Cause**: Node.js v23.6.0 has newer decorator support that conflicts with NestJS v11's experimental decorators.

**Solutions**:
```bash
# Option 1: Use Node.js LTS version (recommended)
# Install Node.js v20 LTS using nvm or your preferred method
nvm install 20
nvm use 20
npm install

# Option 2: Force TypeScript compatibility (if you must use Node.js v23)
# Add to tsconfig.json compilerOptions:
"useDefineForClassFields": false
"target": "ES2022"
"lib": ["ES2022"]

# Option 3: Skip type checking for development (temporary fix)
npm run start:dev -- --type-check=false
```

**Note**: The recommended solution is to use Node.js v20 LTS for better compatibility with NestJS v11.

## 🔧 Environment Configuration

### Required Environment Variables

Make sure your `.env` file has these variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=chat-meaw

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=secret

# External Service
KAHA_MAIN_V3_URL=http://localhost:3001
KAHA_MAIN_V3_SERVICE_TOKEN=your-service-token-here
```

### Database Setup Commands

```bash
# PostgreSQL setup
sudo -u postgres psql
CREATE DATABASE "chat-meaw";
CREATE USER root WITH PASSWORD 'root';
GRANT ALL PRIVILEGES ON DATABASE "chat-meaw" TO root;
\q

# Test connection
psql -h localhost -U root -d chat-meaw -c "SELECT 1;"
```

## 🧪 Testing Steps

### 1. Basic Health Check
```bash
curl http://localhost:3000/health
```

### 2. Authentication Test
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU" \
http://localhost:3000/auth/me
```

### 3. Full API Test
```bash
npm run test:apis
```

## 🐛 Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development DEBUG=* npm run start:dev
```

## 📞 Getting Help

If you're still having issues:

1. Run `npm run check:errors` and share the output
2. Check the application logs for specific error messages
3. Verify your PostgreSQL and Redis are accessible
4. Make sure your `.env` file has correct credentials
5. Try the manual setup steps one by one

## 🔄 Reset Everything

If nothing works, complete reset:

```bash
# Stop the application
# Kill any running processes on port 3000

# Reset database
dropdb chat-meaw
createdb chat-meaw

# Reset Node.js
rm -rf node_modules package-lock.json dist/
npm install

# Reset configuration
rm .env
cp .env.example .env
# Edit .env with your credentials

# Start fresh
npm run migration:run
npm run start:dev
```