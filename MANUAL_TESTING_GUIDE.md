# Manual Testing Guide - Chat Backend

## 🚀 Quick Start

### 1. Start All Services

Make sure these services are running:

```bash
# Terminal 1: Main Chat Backend (should already be running)
npm run start:dev

# Terminal 2: Mock kaha-main-v3 service (should already be running)
node scripts/mock-kaha-service.js

# Terminal 3: UI Server
node scripts/start-ui-server.js
```

### 2. Access the Test UI

Open your browser and go to: **http://localhost:3002**

## 🧪 Testing Scenarios

### Test Users Available:
1. **Alice (Main User)** - `afc70db3-6f43-4882-92fd-4715f25ffc95` (KahaID: U-8C695E)
2. **Bob (Test User 2)** - `12345678-1234-4234-8234-123456789012` (KahaID: U-TEST2)
3. **Charlie (Test User 3)** - `87654321-4321-4321-4321-210987654321` (KahaID: U-TEST3)
4. **Diana (Test User 4)** - `11111111-2222-4333-8444-555555555555` (KahaID: U-TEST4)
5. **Eve (Test User 5)** - `99999999-8888-4777-8666-555555555555` (KahaID: U-TEST5)

### JWT Token (Pre-filled for Alice):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU
```

## 📋 Test Plan

### 1. Authentication & Connection
- [ ] Click "Authenticate" - should show "Authentication successful!"
- [ ] Check connection status - should show "Connected" (green)
- [ ] Verify current user shows: Alice's ID and KahaID

### 2. Create 1-on-1 Direct Chat
- [ ] Click "New 1-on-1" button
- [ ] Enter Bob's ID: `12345678-1234-4234-8234-123456789012`
- [ ] Should create successfully and appear in conversations list
- [ ] Click on the conversation to open it
- [ ] Send a message: "Hello Bob! This is a direct message."
- [ ] Verify message appears in chat area
- [ ] Check PostgreSQL: Message should be stored in `messages` table
- [ ] Check Redis: User profiles should be cached

### 3. Create Business Chat
- [ ] Click "New Business" button
- [ ] Enter business ID: `afc70db3-6f43-4882-92fd-4715f25ffc95`
- [ ] Should create successfully with business profile data
- [ ] Send a message: "I need help with my account."
- [ ] Verify business conversation appears with business name
- [ ] Check mock service logs - should show profile fetch requests

### 4. Create Group Chat
- [ ] Click "New Group" button
- [ ] Enter group name: "Test Group Chat"
- [ ] Enter participant IDs: `12345678-1234-4234-8234-123456789012,87654321-4321-4321-4321-210987654321`
- [ ] Should create successfully (3 participants total including Alice)
- [ ] Send a message: "Welcome to our group chat!"
- [ ] Verify group shows participant count

### 5. Real-time Features Testing
- [ ] Open multiple browser tabs/windows
- [ ] Authenticate as different users (you'll need different JWT tokens)
- [ ] Send messages from one tab
- [ ] Verify messages appear in real-time in other tabs
- [ ] Test typing indicators (start typing in message input)

### 6. Data Persistence Testing
- [ ] Send several messages in different conversations
- [ ] Refresh the browser page
- [ ] Verify all conversations and messages are still there
- [ ] Check PostgreSQL tables:
  ```sql
  SELECT * FROM conversations;
  SELECT * FROM messages;
  SELECT * FROM participants;
  SELECT * FROM users;
  ```

### 7. Profile Service Testing
- [ ] Create conversations with different users
- [ ] Verify user names appear correctly (from mock service)
- [ ] Check Redis cache:
  ```bash
  redis-cli
  KEYS profile:*
  GET profile:user:afc70db3-6f43-4882-92fd-4715f25ffc95
  ```

### 8. WebSocket Features
- [ ] Join a conversation - check browser console for WebSocket events
- [ ] Send messages - verify real-time delivery
- [ ] Test connection status indicator
- [ ] Test typing indicators (if implemented)

### 9. Error Handling
- [ ] Try creating conversation with invalid user ID
- [ ] Try sending empty messages
- [ ] Disconnect internet and verify error handling
- [ ] Test with invalid JWT token

### 10. API Endpoints Testing
Use the UI to test these endpoints indirectly:
- [ ] `GET /conversations` - Loading conversations list
- [ ] `POST /conversations/direct` - Creating direct chats
- [ ] `POST /conversations/group` - Creating group chats
- [ ] `POST /conversations/business` - Creating business chats
- [ ] `GET /conversations/:id` - Opening specific conversations
- [ ] `POST /conversations/:id/messages` - Sending messages
- [ ] `GET /conversations/:id/messages` - Loading message history

## 🔍 What to Verify

### Database (PostgreSQL)
```sql
-- Check users table
SELECT id, "kahaId", "createdAt" FROM users;

-- Check conversations
SELECT id, type, "businessId", name, "createdAt" FROM conversations;

-- Check participants
SELECT "conversationId", "userId", role FROM participants;

-- Check messages
SELECT id, content, "senderId", "conversationId", "createdAt" FROM messages;
```

### Cache (Redis)
```bash
# Check cached profiles
redis-cli KEYS profile:*

# Check specific user profile
redis-cli GET profile:user:afc70db3-6f43-4882-92fd-4715f25ffc95
```

### Mock Service Logs
Check the mock kaha-main-v3 service terminal for:
- Profile fetch requests
- User and business profile responses

### WebSocket Events
Open browser Developer Tools → Network → WS to see:
- Connection establishment
- Message events
- Typing indicators
- Room join/leave events

## 🎯 Success Criteria

✅ **All features working if:**
- Authentication works with JWT token
- All conversation types can be created (direct, group, business)
- Messages send and receive in real-time
- Data persists in PostgreSQL
- User profiles load from mock service and cache in Redis
- WebSocket connection stays stable
- UI updates in real-time across multiple tabs
- No console errors in browser
- All API calls return successful responses

## 🐛 Troubleshooting

### Common Issues:
1. **Connection Failed**: Check if backend is running on port 3000
2. **Authentication Failed**: Verify JWT token is correct
3. **WebSocket Issues**: Check CORS settings and firewall
4. **Database Errors**: Verify PostgreSQL is running and accessible
5. **Profile Loading Issues**: Check if mock service is running on port 3001
6. **Redis Issues**: Verify Redis server is running

### Debug Commands:
```bash
# Check if services are running
curl http://localhost:3000/health
curl http://localhost:3001/health

# Test database connection
node scripts/check-database.js

# Test Redis connection
node scripts/test-redis.js

# Run API tests
node scripts/test-all-apis.js
```

This comprehensive testing will verify that your chat backend is fully functional with all features working as expected!