# Manual Testing Plan - Chat Backend Microservice

**Version**: 1.0  
**Date**: August 17, 2025  
**Purpose**: Comprehensive manual testing guide from basic setup to advanced features

## 📋 Testing Overview

This manual testing plan provides step-by-step instructions to test the entire chat backend system, from initial setup to advanced business chat workflows. Each section builds upon the previous one, ensuring comprehensive coverage.

## 🛠️ Prerequisites and Setup

### Environment Setup
1. **Database Setup**
   ```bash
   # PostgreSQL
   createdb chat_backend
   
   # Redis
   redis-server --port 6379
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Application Startup**
   ```bash
   npm install
   npm run build
   npm run migration:run
   npm run start:dev
   ```

4. **Verify Application Health**
   ```bash
   curl http://localhost:3000/
   # Expected: {"status":"ok","timestamp":"..."}
   ```

### Testing Tools Required
- **Postman** or **Insomnia** (API testing)
- **WebSocket client** (for real-time testing)
- **JWT.io** (for token inspection)
- **Redis CLI** (for cache inspection)
- **PostgreSQL client** (for database inspection)

---

## 🧪 Phase 1: Basic System Testing

### 1.1 Health Check and Documentation
**Objective**: Verify basic application functionality

**Test Steps**:
1. **Health Endpoint**
   ```bash
   GET http://localhost:3000/
   Expected: 200 OK with status and timestamp
   ```

2. **Detailed Health**
   ```bash
   GET http://localhost:3000/health
   Expected: 200 OK with service info, uptime, memory usage
   ```

3. **API Documentation**
   ```bash
   GET http://localhost:3000/api/docs
   Expected: Swagger UI interface
   ```

4. **OpenAPI Spec**
   ```bash
   GET http://localhost:3000/api/docs-json
   Expected: JSON OpenAPI specification
   ```

**Success Criteria**: ✅ All endpoints return expected responses

### 1.2 Authentication System
**Objective**: Test JWT authentication flow

**Test Steps**:
1. **Create Test JWT Token**
   ```javascript
   // Use JWT.io or create programmatically
   {
     "sub": "550e8400-e29b-41d4-a716-446655440001",
     "kahaId": "test-user-001",
     "iat": 1692259200
   }
   ```

2. **Test Unauthenticated Request**
   ```bash
   GET http://localhost:3000/conversations
   Expected: 401 Unauthorized
   ```

3. **Test Authenticated Request**
   ```bash
   GET http://localhost:3000/conversations
   Authorization: Bearer <your-jwt-token>
   Expected: 200 OK with empty conversations array
   ```

4. **Verify User Auto-Creation**
   ```sql
   SELECT * FROM users WHERE kaha_id = 'test-user-001';
   Expected: User record created automatically
   ```

**Success Criteria**: ✅ Authentication works, user auto-created

---

## 💬 Phase 2: Core Conversation Testing

### 2.1 Direct Conversations
**Objective**: Test one-on-one messaging

**Setup**: Create two test users
```javascript
User A: {
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "kahaId": "test-user-a"
}

User B: {
  "sub": "550e8400-e29b-41d4-a716-446655440002", 
  "kahaId": "test-user-b"
}
```

**Test Steps**:
1. **Create Direct Conversation (User A)**
   ```bash
   POST http://localhost:3000/conversations/direct
   Authorization: Bearer <user-a-token>
   Content-Type: application/json
   
   {
     "participantId": "550e8400-e29b-41d4-a716-446655440002"
   }
   
   Expected: 201 Created with conversation object
   Save conversationId for next steps
   ```

2. **Send Message (User A)**
   ```bash
   POST http://localhost:3000/conversations/{conversationId}/messages
   Authorization: Bearer <user-a-token>
   Content-Type: application/json
   
   {
     "content": "Hello from User A!"
   }
   
   Expected: 201 Created with message object
   ```

3. **Retrieve Messages (User B)**
   ```bash
   GET http://localhost:3000/conversations/{conversationId}/messages
   Authorization: Bearer <user-b-token>
   
   Expected: 200 OK with messages array containing User A's message
   ```

4. **Reply Message (User B)**
   ```bash
   POST http://localhost:3000/conversations/{conversationId}/messages
   Authorization: Bearer <user-b-token>
   Content-Type: application/json
   
   {
     "content": "Hello back from User B!"
   }
   
   Expected: 201 Created
   ```

5. **List Conversations (Both Users)**
   ```bash
   GET http://localhost:3000/conversations
   Authorization: Bearer <user-token>
   
   Expected: 200 OK with conversation in list for both users
   ```

**Success Criteria**: ✅ Direct conversation created, messages exchanged, visible to both users

### 2.2 Group Conversations
**Objective**: Test multi-user group messaging

**Setup**: Create third test user
```javascript
User C: {
  "sub": "550e8400-e29b-41d4-a716-446655440003",
  "kahaId": "test-user-c"
}
```

**Test Steps**:
1. **Create Group Conversation**
   ```bash
   POST http://localhost:3000/conversations/group
   Authorization: Bearer <user-a-token>
   Content-Type: application/json
   
   {
     "name": "Test Group Chat",
     "participantIds": [
       "550e8400-e29b-41d4-a716-446655440001",
       "550e8400-e29b-41d4-a716-446655440002",
       "550e8400-e29b-41d4-a716-446655440003"
     ]
   }
   
   Expected: 201 Created with group conversation
   ```

2. **Send Group Message**
   ```bash
   POST http://localhost:3000/conversations/{groupConversationId}/messages
   Authorization: Bearer <user-a-token>
   Content-Type: application/json
   
   {
     "content": "Hello everyone in the group!"
   }
   
   Expected: 201 Created
   ```

3. **Verify All Members Can Read**
   ```bash
   # Test with User B and User C tokens
   GET http://localhost:3000/conversations/{groupConversationId}/messages
   Authorization: Bearer <user-b-token>
   
   Expected: 200 OK with group message visible
   ```

4. **Add New Participant**
   ```bash
   POST http://localhost:3000/conversations/{groupConversationId}/participants
   Authorization: Bearer <user-a-token>
   Content-Type: application/json
   
   {
     "userId": "550e8400-e29b-41d4-a716-446655440004"
   }
   
   Expected: 201 Created (if user exists) or appropriate error
   ```

5. **Test Group Size Limit**
   ```bash
   # Try adding participants beyond limit (8 total)
   # Should return 400 Bad Request when limit exceeded
   ```

**Success Criteria**: ✅ Group conversation created, all members can participate, size limits enforced

### 2.3 Business Conversations
**Objective**: Test customer-to-business messaging

**Setup**: Create business and agent users
```javascript
Customer: {
  "sub": "550e8400-e29b-41d4-a716-446655440005",
  "kahaId": "customer-001"
}

Agent: {
  "sub": "550e8400-e29b-41d4-a716-446655440006",
  "kahaId": "agent-001"
}

Business Owner: {
  "sub": "550e8400-e29b-41d4-a716-446655440007",
  "kahaId": "business-owner-001"
}
```

**Test Steps**:
1. **Create Business Conversation (Customer)**
   ```bash
   POST http://localhost:3000/conversations/business
   Authorization: Bearer <customer-token>
   Content-Type: application/json
   
   {
     "businessId": "550e8400-e29b-41d4-a716-446655440100",
     "subject": "Product Support Inquiry"
   }
   
   Expected: 201 Created with business conversation
   ```

2. **Send Customer Message**
   ```bash
   POST http://localhost:3000/conversations/{businessConversationId}/messages
   Authorization: Bearer <customer-token>
   Content-Type: application/json
   
   {
     "content": "I need help with my recent order #12345"
   }
   
   Expected: 201 Created
   ```

3. **Assign Agent (Business Owner)**
   ```bash
   POST http://localhost:3000/conversations/{businessConversationId}/assign-agent
   Authorization: Bearer <business-owner-token>
   Content-Type: application/json
   
   {
     "agentId": "550e8400-e29b-41d4-a716-446655440006"
   }
   
   Expected: 200 OK
   ```

4. **Agent Response**
   ```bash
   POST http://localhost:3000/conversations/{businessConversationId}/messages
   Authorization: Bearer <agent-token>
   Content-Type: application/json
   
   {
     "content": "Hello! I'd be happy to help with your order. Can you provide more details?"
   }
   
   Expected: 201 Created
   ```

5. **Check Business Inbox**
   ```bash
   GET http://localhost:3000/business/inbox
   Authorization: Bearer <agent-token>
   
   Expected: 200 OK with assigned conversations
   ```

**Success Criteria**: ✅ Business conversation created, agent assigned, customer-agent communication working

---

## 📱 Phase 3: Real-time Features Testing

### 3.1 WebSocket Connection
**Objective**: Test real-time messaging capabilities

**Test Steps**:
1. **Establish WebSocket Connection**
   ```javascript
   // Using WebSocket client or browser console
   const socket = io('http://localhost:3000', {
     auth: {
       token: 'your-jwt-token'
     }
   });
   
   socket.on('connect', () => {
     console.log('Connected to WebSocket');
   });
   ```

2. **Join Conversation Room**
   ```javascript
   socket.emit('join-conversation', {
     conversationId: 'your-conversation-id'
   });
   
   socket.on('joined-conversation', (data) => {
     console.log('Joined conversation:', data);
   });
   ```

3. **Test Real-time Message Delivery**
   ```javascript
   // Listen for new messages
   socket.on('new-message', (message) => {
     console.log('New message received:', message);
   });
   
   // Send message via HTTP API from another user
   // Should receive real-time notification
   ```

**Success Criteria**: ✅ WebSocket connection established, real-time message delivery working

### 3.2 Presence System
**Objective**: Test user online/offline status

**Test Steps**:
1. **Send Presence Update**
   ```javascript
   socket.emit('presence-update', { status: 'online' });
   ```

2. **Listen for Presence Changes**
   ```javascript
   socket.on('user-online', (data) => {
     console.log('User came online:', data.userId);
   });
   
   socket.on('user-offline', (data) => {
     console.log('User went offline:', data.userId);
   });
   ```

3. **Test Heartbeat Mechanism**
   ```javascript
   // Send heartbeat every 15 seconds
   setInterval(() => {
     socket.emit('heartbeat');
   }, 15000);
   
   socket.on('heartbeat-ack', () => {
     console.log('Heartbeat acknowledged');
   });
   ```

**Success Criteria**: ✅ Presence updates working, heartbeat mechanism functional

### 3.3 Typing Indicators
**Objective**: Test typing status notifications

**Test Steps**:
1. **Start Typing**
   ```javascript
   socket.emit('typing-start', {
     conversationId: 'your-conversation-id'
   });
   ```

2. **Listen for Typing Events**
   ```javascript
   socket.on('user-typing', (data) => {
     console.log(`${data.userId} is typing: ${data.isTyping}`);
   });
   ```

3. **Stop Typing**
   ```javascript
   socket.emit('typing-stop', {
     conversationId: 'your-conversation-id'
   });
   ```

4. **Test Auto-expiry (5 seconds)**
   ```javascript
   // Start typing and wait 6 seconds without stopping
   // Should automatically receive typing-stop event
   ```

**Success Criteria**: ✅ Typing indicators working, auto-expiry functional

### 3.4 Read Receipts
**Objective**: Test message read status tracking

**Test Steps**:
1. **Mark Message as Read**
   ```javascript
   socket.emit('mark-message-read', {
     conversationId: 'your-conversation-id',
     messageId: 'your-message-id'
   });
   ```

2. **Listen for Read Receipts**
   ```javascript
   socket.on('message-read', (data) => {
     console.log(`Message ${data.messageId} read by ${data.readBy}`);
   });
   ```

3. **Verify Database Update**
   ```sql
   SELECT last_read_message_id FROM participants 
   WHERE user_id = 'your-user-id' AND conversation_id = 'your-conversation-id';
   ```

**Success Criteria**: ✅ Read receipts working, database updated correctly

---

## 🔧 Phase 4: Advanced Features Testing

### 4.1 Message Management
**Objective**: Test message lifecycle operations

**Test Steps**:
1. **Send Different Message Types**
   ```bash
   # Text message
   POST /conversations/{id}/messages
   { "content": "Text message", "type": "text" }
   
   # System message
   POST /conversations/{id}/messages  
   { "content": "User joined", "type": "system" }
   ```

2. **Message Pagination**
   ```bash
   GET /conversations/{id}/messages?limit=10&offset=0
   GET /conversations/{id}/messages?limit=10&offset=10
   
   Expected: Proper pagination with total count
   ```

3. **Soft Delete Message**
   ```bash
   DELETE /messages/{messageId}
   Authorization: Bearer <sender-token>
   
   Expected: 200 OK, message marked as deleted
   ```

4. **Verify Soft Delete**
   ```bash
   GET /conversations/{id}/messages
   Expected: Deleted message not in results
   
   # Check database
   SELECT * FROM messages WHERE id = 'message-id';
   Expected: deleted_at timestamp set
   ```

5. **Message Search**
   ```bash
   GET /conversations/{id}/messages/search?q=keyword
   Expected: Messages containing keyword
   ```

**Success Criteria**: ✅ All message operations working correctly

### 4.2 Notification System
**Objective**: Test unread counts and muting

**Test Steps**:
1. **Get Unread Count**
   ```bash
   GET /conversations/unread-count
   Authorization: Bearer <user-token>
   
   Expected: Total unread count across all conversations
   ```

2. **Mute Conversation**
   ```bash
   PATCH /conversations/{id}/mute
   Authorization: Bearer <user-token>
   
   Expected: 200 OK
   ```

3. **Unmute Conversation**
   ```bash
   PATCH /conversations/{id}/unmute
   Authorization: Bearer <user-token>
   
   Expected: 200 OK
   ```

4. **Verify Mute Status**
   ```sql
   SELECT is_muted FROM participants 
   WHERE user_id = 'user-id' AND conversation_id = 'conversation-id';
   ```

**Success Criteria**: ✅ Notification features working correctly

### 4.3 Business Chat Advanced Features
**Objective**: Test business-specific functionality

**Test Steps**:
1. **Agent Availability**
   ```bash
   PATCH /business/agent/availability
   Authorization: Bearer <agent-token>
   Content-Type: application/json
   
   {
     "available": true,
     "businessId": "business-id"
   }
   
   Expected: 200 OK
   ```

2. **Auto-assign Agent**
   ```bash
   POST /conversations/{id}/auto-assign-agent
   Authorization: Bearer <business-owner-token>
   Content-Type: application/json
   
   {
     "businessId": "business-id"
   }
   
   Expected: 200 OK with assigned agent
   ```

3. **Agent Workload**
   ```bash
   GET /business/{businessId}/agent-workload
   Authorization: Bearer <business-owner-token>
   
   Expected: Agent workload statistics
   ```

4. **Business Analytics**
   ```bash
   GET /business/{businessId}/analytics
   Authorization: Bearer <business-owner-token>
   
   Expected: Conversation metrics and statistics
   ```

**Success Criteria**: ✅ Business features working correctly

---

## 🚀 Phase 5: Performance and Monitoring Testing

### 5.1 Database Performance
**Objective**: Test database optimizations and monitoring

**Test Steps**:
1. **Performance Metrics**
   ```bash
   GET /admin/database/metrics
   Authorization: Bearer <admin-token>
   
   Expected: Connection pool stats, slow queries, index usage
   ```

2. **Database Size**
   ```bash
   GET /admin/database/size
   Authorization: Bearer <admin-token>
   
   Expected: Database and table size information
   ```

3. **Index Suggestions**
   ```bash
   GET /admin/database/index-suggestions
   Authorization: Bearer <admin-token>
   
   Expected: Optimization recommendations
   ```

4. **Query Analysis**
   ```bash
   POST /admin/database/analyze-query?query=SELECT * FROM messages LIMIT 10
   Authorization: Bearer <admin-token>
   
   Expected: Query execution plan and performance metrics
   ```

5. **Manual Optimization**
   ```bash
   POST /admin/database/optimize
   Authorization: Bearer <admin-token>
   
   Expected: 200 OK, database optimization completed
   ```

**Success Criteria**: ✅ Performance monitoring working, optimizations effective

### 5.2 Load Testing
**Objective**: Test system under load

**Test Steps**:
1. **Concurrent Connections**
   ```bash
   # Use load testing tool (Artillery, JMeter, or custom script)
   # Test 100+ concurrent WebSocket connections
   ```

2. **Message Throughput**
   ```bash
   # Send 1000+ messages across multiple conversations
   # Measure response times and success rates
   ```

3. **Database Performance Under Load**
   ```bash
   # Monitor query times during load test
   # Check connection pool utilization
   ```

4. **Memory and CPU Usage**
   ```bash
   # Monitor system resources during load test
   # Verify no memory leaks or excessive CPU usage
   ```

**Success Criteria**: ✅ System handles expected load without degradation

---

## 🔍 Phase 6: Error Handling and Edge Cases

### 6.1 Authentication Errors
**Test Steps**:
1. **Invalid JWT Token**
   ```bash
   GET /conversations
   Authorization: Bearer invalid-token
   Expected: 401 Unauthorized
   ```

2. **Expired JWT Token**
   ```bash
   # Use expired token
   Expected: 401 Unauthorized
   ```

3. **Missing Authorization Header**
   ```bash
   GET /conversations
   Expected: 401 Unauthorized
   ```

### 6.2 Validation Errors
**Test Steps**:
1. **Invalid Conversation ID**
   ```bash
   GET /conversations/invalid-uuid/messages
   Expected: 400 Bad Request or 404 Not Found
   ```

2. **Empty Message Content**
   ```bash
   POST /conversations/{id}/messages
   { "content": "" }
   Expected: 400 Bad Request
   ```

3. **Invalid Participant ID**
   ```bash
   POST /conversations/direct
   { "participantId": "invalid-uuid" }
   Expected: 400 Bad Request
   ```

### 6.3 Permission Errors
**Test Steps**:
1. **Unauthorized Conversation Access**
   ```bash
   # Try accessing conversation user is not part of
   Expected: 403 Forbidden
   ```

2. **Unauthorized Message Deletion**
   ```bash
   # Try deleting another user's message
   Expected: 403 Forbidden
   ```

3. **Unauthorized Agent Assignment**
   ```bash
   # Try assigning agent without business owner permissions
   Expected: 403 Forbidden
   ```

**Success Criteria**: ✅ All error scenarios handled gracefully with appropriate status codes

---

## 📊 Testing Checklist and Sign-off

### Core Functionality ✅
- [ ] Health checks working
- [ ] Authentication flow complete
- [ ] User auto-creation working
- [ ] Direct conversations functional
- [ ] Group conversations functional
- [ ] Business conversations functional
- [ ] Message CRUD operations working
- [ ] Message pagination working

### Real-time Features ✅
- [ ] WebSocket connections established
- [ ] Real-time message delivery working
- [ ] Presence system functional
- [ ] Typing indicators working
- [ ] Read receipts working
- [ ] Connection handling robust

### Advanced Features ✅
- [ ] Message search working
- [ ] Unread counts accurate
- [ ] Conversation muting working
- [ ] Agent assignment working
- [ ] Business analytics working
- [ ] Performance monitoring working

### Error Handling ✅
- [ ] Authentication errors handled
- [ ] Validation errors handled
- [ ] Permission errors handled
- [ ] Network errors handled gracefully
- [ ] Database errors handled gracefully

### Performance ✅
- [ ] Response times acceptable (< 200ms for most operations)
- [ ] System handles expected concurrent load
- [ ] Database queries optimized
- [ ] Memory usage stable
- [ ] No resource leaks detected

### Security ✅
- [ ] JWT validation working
- [ ] Authorization checks in place
- [ ] Input validation working
- [ ] SQL injection protection verified
- [ ] XSS protection verified

---

## 🎯 Final Validation

### Production Readiness Checklist
- [ ] All manual tests passed
- [ ] Integration tests passing (23/23)
- [ ] Performance benchmarks met
- [ ] Security validations complete
- [ ] Error handling comprehensive
- [ ] Documentation complete
- [ ] Monitoring and alerting configured
- [ ] Database optimizations verified
- [ ] Load testing completed successfully

### Sign-off
- [ ] **Developer Testing**: All functionality verified
- [ ] **QA Testing**: Edge cases and error scenarios tested
- [ ] **Performance Testing**: Load and stress testing completed
- [ ] **Security Testing**: Authentication and authorization verified
- [ ] **Integration Testing**: External service integration tested
- [ ] **User Acceptance Testing**: Business requirements validated

**Testing Completed By**: ________________  
**Date**: ________________  
**Version Tested**: ________________  
**Ready for Production**: [ ] Yes [ ] No

---

## 📝 Notes and Issues

### Known Issues
- Document any issues found during testing
- Include severity level and workaround if available

### Performance Notes
- Record actual performance metrics achieved
- Note any optimizations applied during testing

### Recommendations
- List any improvements or optimizations identified
- Prioritize recommendations for future releases

This comprehensive manual testing plan ensures thorough validation of the entire chat backend system before production deployment.