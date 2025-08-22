# Chat Backend

Real-time messaging microservice built with NestJS, PostgreSQL, and Redis.

## 🚀 Quick Start (Host System)

### Prerequisites
- Node.js 18+
- PostgreSQL running on your host system
- Redis running on your host system

### Setup Steps

1. **Install dependencies**
```bash
npm install
```

2. **Ensure databases are running**
```bash
# PostgreSQL should be running with database 'chat-meaw'
# Redis should be running on default port 6379
```

3. **Quick setup and start**
```bash
npm run setup:host
```

**OR Manual setup:**
```bash
cp .env.example .env
# Edit .env with your database credentials
npm run migration:run
npm run start:dev
```

## 🧪 Testing the APIs

### Test JWT Token
```bash
node scripts/test-jwt.js
```

### Test All APIs
```bash
# Make sure the server is running first
npm run start:dev

# In another terminal:
node scripts/test-apis.js
```

### Manual API Testing

**Base URL:** `http://localhost:3000`

**JWT Token:** 
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU
```

**Headers:**
```json
{
  "Authorization": "Bearer <JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

### Key Endpoints to Test

1. **Health Check**
   ```bash
   GET /health
   ```

2. **Authentication**
   ```bash
   GET /auth/me
   ```

3. **Create Direct Conversation**
   ```bash
   POST /conversations/direct
   {
     "targetUserId": "afc70db3-6f43-4882-92fd-4715f25ffc95"
   }
   ```

4. **Send Message**
   ```bash
   POST /conversations/{conversationId}/messages
   {
     "content": "Hello World!",
     "type": "text"
   }
   ```

5. **Get Conversations**
   ```bash
   GET /conversations
   ```

## 📚 API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:3000/api/docs
- **Health Check:** http://localhost:3000/health

## 🔧 Development Tools

### Database Management
- **pgAdmin:** http://localhost:8080 (admin@example.com / admin)
- **Redis Commander:** http://localhost:8081

### Useful Scripts
```bash
npm run start:dev        # Development server with hot reload
npm run build           # Build for production
npm run test            # Run tests
npm run lint            # Code linting
npm run migration:run   # Run database migrations
```

## 🏗️ Architecture

### Core Modules
- **Auth** - JWT authentication & user management
- **Conversations** - Direct, group & business conversations
- **Messages** - Message handling & persistence
- **Business** - Agent assignment & business chat
- **Realtime** - WebSocket, presence & typing indicators
- **Notifications** - Read receipts & notifications

### Database Schema
- **Users** - User accounts from external service
- **Conversations** - Chat containers (direct/group/business)
- **Messages** - Individual messages with soft delete
- **Participants** - User-conversation relationships with roles

### Real-time Features
- WebSocket connection on `/chat` namespace
- Presence tracking (online/away/offline)
- Typing indicators with auto-cleanup
- Read receipts and message status
- Live message broadcasting

## 🔐 Authentication

The system uses JWT tokens from an external service (kaha-main-v3). Users are automatically created in the local database when they first authenticate.

**Token Payload:**
```json
{
  "id": "user-uuid",
  "kahaId": "external-user-id",
  "iat": 1753323158
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **Redis Connection Failed**
   ```bash
   # Check if Redis is running
   docker-compose ps redis
   
   # Test Redis connection
   redis-cli ping
   ```

3. **JWT Token Invalid**
   ```bash
   # Test your token
   node scripts/test-jwt.js
   ```

4. **Migration Errors**
   ```bash
   # Reset database (WARNING: destroys data)
   docker-compose down -v
   docker-compose up -d postgres redis
   npm run migration:run
   ```

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development npm run start:dev
```

## 📊 Monitoring

### Health Endpoints
- `GET /health` - Basic health check
- `GET /auth/health` - Auth service health

### Metrics Available
- Active WebSocket connections
- Message throughput
- Database connection pool status
- Redis connection status
- Presence statistics

## 🔄 Business Chat Features

### Agent Assignment
- **Round Robin** - Distribute evenly among available agents
- **Least Busy** - Assign to agent with fewest active chats
- **Skill-based** - Match agents by category/skills
- **Manual** - Specific agent assignment

### Business Hours
- Configurable timezone and schedule
- Holiday management
- Special hours for specific dates
- Automatic queue management outside hours

## 🌐 WebSocket Usage

### Connection
```javascript
const socket = io('http://localhost:3000/chat', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events
```javascript
// Join conversation
socket.emit('join_conversation', { conversationId: 'uuid' });

// Send typing indicator
socket.emit('start_typing', { conversationId: 'uuid' });

// Listen for messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

## 📝 License

MIT License - see LICENSE file for details.


yesterday --today
work on chat business profile chat(chatbot)(major work)
work on HOTEL backend 
    --steup 
    --make docs
    --opt login 
    --web hotel registration
    ... add more here
-setup project for JOB PORTAL

-update room api per frontend requirement
- work on inhacnment
- added new api for notifcation(sos, hotel, hostel)
- update the SOS api for web(designa changes and, inhancement)