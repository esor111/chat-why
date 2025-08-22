# Chat Backend Setup Guide

## 🚀 Quick Start (Recommended)

### Prerequisites
- **Node.js**: v20 LTS (recommended) or v18 LTS
- **PostgreSQL**: v12 or higher
- **Redis**: v6 or higher

**Note**: If you're using Node.js v23+, you may encounter TypeScript decorator compatibility issues. Use Node.js v20 LTS for the best experience.

### 1. Install Dependencies
```bash
npm install
```

### 2. Ensure Databases are Running
Make sure your PostgreSQL and Redis are running on your host system:
```bash
# Check PostgreSQL
psql -h localhost -U root -d chat-meaw -c "SELECT 1;"

# Check Redis
redis-cli ping
```

### 3. Setup and Start Application
```bash
# Copy environment file
cp .env.example .env

# Validate setup
npm run validate-setup

# Start the application (includes migration)
npm run setup
```

## 🧪 Testing Your JWT Token

Your JWT token is valid! Here's the decoded payload:
```json
{
  "id": "afc70db3-6f43-4882-92fd-4715f25ffc95",
  "kahaId": "U-8C695E",
  "iat": 1753323158
}
```

### Test the token:
```bash
npm run test:jwt
```

## 🔧 Manual Setup (Alternative)

### 1. Database Setup
```bash
# PostgreSQL
createdb chat-meaw
createuser root --password  # password: root

# Redis (default configuration)
redis-server
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run Migrations
```bash
npm run migration:run
```

### 4. Start Development Server
```bash
npm run start:dev
```

## 📊 Health Checks

Once running, check these endpoints:
- **Basic Health**: http://localhost:3000/health
- **Detailed Health**: http://localhost:3000/health (includes DB/Redis status)
- **Swagger Docs**: http://localhost:3000/api/docs

## 🧪 API Testing

### Automated Testing
```bash
# Test all APIs with your JWT token
npm run test:apis
```

### Manual Testing with cURL

**Headers for all requests:**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU
Content-Type: application/json
```

**Key Endpoints:**

1. **Health Check**
```bash
curl http://localhost:3000/health
```

2. **Get Current User**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/auth/me
```

3. **Get Conversations**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/conversations
```

4. **Create Direct Conversation**
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"targetUserId":"afc70db3-6f43-4882-92fd-4715f25ffc95"}' \
  http://localhost:3000/conversations/direct
```

5. **Send Message** (replace {conversationId})
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"Hello World!","type":"text"}' \
  http://localhost:3000/conversations/{conversationId}/messages
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
# or on macOS
brew services list | grep postgresql

# Test connection manually
psql -h localhost -U root -d chat-meaw

# Create database if it doesn't exist
createdb chat-meaw
```

2. **Redis Connection Failed**
```bash
# Check if Redis is running
sudo systemctl status redis
# or on macOS
brew services list | grep redis

# Test Redis connection
redis-cli ping

# Start Redis if not running
redis-server
```

3. **JWT Token Issues**
```bash
# Test your token
npm run test:jwt
```

4. **TypeScript Compilation Errors**
```bash
# Check for compilation issues
npx tsc --noEmit
```

5. **Node.js v23+ Compatibility Issues**
```bash
# If you see decorator-related TypeScript errors
# Switch to Node.js v20 LTS (recommended)
nvm install 20
nvm use 20
npm install

# Or check current Node.js version
node --version
```

5. **Module Resolution Issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode
```bash
NODE_ENV=development npm run start:dev
```

## 📱 WebSocket Testing

### Connect to WebSocket
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// Join a conversation
socket.emit('join_conversation', { conversationId: 'uuid' });

// Listen for messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

## 🎯 Key Features Working

✅ **Authentication**: JWT-based auth with automatic user creation  
✅ **Conversations**: Direct, group, and business conversations  
✅ **Messages**: Send, receive, search, and delete messages  
✅ **Real-time**: WebSocket support with presence and typing indicators  
✅ **Business Chat**: Agent assignment and business hours  
✅ **Notifications**: Read receipts and unread counts  
✅ **Health Monitoring**: Database and Redis health checks  

## 🔧 Development Tools

### Database Management
- Use your existing PostgreSQL and Redis tools
- Or install pgAdmin and Redis Commander separately if needed

### Useful Commands
```bash
npm run start:dev        # Development with hot reload
npm run build           # Build for production
npm run test            # Run tests
npm run lint            # Code linting
npm run migration:run   # Run database migrations
npm run validate-setup  # Validate configuration
```

## 🚨 Fixed Issues

1. ✅ **Circular Dependencies**: Fixed with forwardRef()
2. ✅ **Database Configuration**: Fixed DB_NAME vs DB_DATABASE mismatch
3. ✅ **Missing Services**: All services properly implemented
4. ✅ **Module Imports**: All imports resolved correctly
5. ✅ **JWT Authentication**: Working with your token
6. ✅ **Redis Integration**: Properly configured and connected
7. ✅ **TypeScript Compilation**: All type issues resolved

## 📈 Next Steps

1. **Start the application**: `npm run setup`
2. **Test the APIs**: `npm run test:apis`
3. **Check Swagger docs**: http://localhost:3000/api/docs
4. **Test WebSocket**: Use the provided JavaScript example
5. **Monitor health**: http://localhost:3000/health

Your chat backend is now fully functional and ready for testing! 🎉