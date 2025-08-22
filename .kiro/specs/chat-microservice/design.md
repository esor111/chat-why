# Design Document

## Overview

The chat microservice (chat-backend) is designed as a lightweight, UUID-based messaging system that integrates with an existing user/business service (kaha-main-v3). The system follows strict data ownership principles where chat-backend handles messaging metadata while kaha-main-v3 remains the source of truth for all profile information.

The architecture supports three conversation types: 1:1 messaging, small group chats (max 8 participants), and business-to-user communication with automatic agent assignment. The system is designed to serve 50k-100k users with 90-day message retention and real-time features including presence, typing indicators, and read receipts.

## Architecture

### Microservice Boundaries

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│  kaha-main-v3   │◄─────►│  chat-backend   │◄─────►│     Clients     │
│ (User Service)  │       │ (Chat Service)  │       │ (Web/Mobile)    │
│                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                          │                          │
        │                          │                          │
        ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   PostgreSQL    │       │   PostgreSQL    │       │   WebSocket     │
│ (User Profiles) │       │ (Chat Metadata) │       │  Connections    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │      Redis      │
                          │ (Cache/Realtime)│
                          └─────────────────┘
```

### Data Ownership Model

- **kaha-main-v3**: User profiles, business profiles, user-business relationships
- **chat-backend**: Conversations, messages, participants, presence, typing indicators
- **Redis**: Profile cache, presence data, typing indicators, unread counts, message queues

## Components and Interfaces

### NestJS Architecture

The application follows NestJS best practices with a modular architecture:

```
src/
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.guard.ts
│   ├── jwt.strategy.ts
│   └── decorators/
│       └── current-user.decorator.ts
├── conversations/
│   ├── conversations.module.ts
│   ├── conversations.controller.ts
│   ├── conversations.service.ts
│   ├── conversations.gateway.ts
│   └── dto/
├── messages/
│   ├── messages.module.ts
│   ├── messages.controller.ts
│   ├── messages.service.ts
│   └── dto/
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── dto/
├── profile/
│   ├── profile.module.ts
│   ├── profile.service.ts
│   └── dto/
├── realtime/
│   ├── realtime.module.ts
│   ├── realtime.gateway.ts
│   └── realtime.service.ts
├── database/
│   ├── database.module.ts
│   └── entities/
└── common/
    ├── guards/
    ├── interceptors/
    ├── pipes/
    └── decorators/
```

### Core Services

#### 1. MessagesService

Handles message creation, retrieval, and lifecycle management.

**Key Methods:**

- `sendMessage(conversationId: string, senderId: string, content: string, type?: string)`: Creates and broadcasts new message
- `getMessages(conversationId: string, limit: number, offset: number)`: Retrieves message history with pagination
- `deleteMessage(messageId: string, userId: string)`: Soft deletes message (sets deletedAt)
- `archiveOldMessages()`: Background job for 90-day retention policy

#### 2. ConversationsService

Manages conversation creation and participant management.

**Key Methods:**

- `createDirectConversation(user1Id: string, user2Id: string)`: Creates 1:1 conversation
- `createGroupConversation(creatorId: string, participantIds: string[], name?: string)`: Creates group chat
- `createBusinessConversation(userId: string, businessId: string)`: Creates business chat with agent assignment
- `addParticipant(conversationId: string, userId: string, role: ParticipantRole)`: Adds user to conversation
- `removeParticipant(conversationId: string, userId: string)`: Removes user from conversation

#### 3. ProfileService

Handles communication with kaha-main-v3 for profile data.

**Key Methods:**

- `batchFetchProfiles(userIds: string[], businessIds: string[])`: Fetches profile data from kaha-main-v3
- `invalidateProfileCache(userId: string)`: Removes cached profile data
- `enrichConversationData(conversations: Conversation[])`: Adds profile data to conversation metadata

#### 4. RealtimeService

Manages WebSocket connections and real-time features.

**Key Methods:**

- `broadcastMessage(conversationId: string, message: Message)`: Sends message to all participants
- `updatePresence(userId: string, status: PresenceStatus)`: Updates user online/offline status
- `sendTypingIndicator(conversationId: string, userId: string, isTyping: boolean)`: Manages typing indicators
- `updateReadReceipt(conversationId: string, userId: string, messageId: string)`: Updates last read message

### External Integrations

#### kaha-main-v3 Integration

**Batch Profile API:**

```http
POST /api/batch/profiles
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json

{
  "user_uuids": ["a1b2c3...", "d4e5f6..."],
  "business_uuids": ["x7y8z9...", "p1q2r3..."]
}
```

**Response Format:**

```json
{
  "users": [
    {
      "uuid": "a1b2c3...",
      "name": "Ishwor Thapa",
      "avatar_url": "https://cdn.example.com/users/a1b2c3.jpg"
    }
  ],
  "businesses": [
    {
      "uuid": "x7y8z9...",
      "name": "Nike Nepal",
      "avatar_url": "https://cdn.example.com/businesses/x7y8z9.png"
    }
  ]
}
```

**Event Integration (Optional):**

- `user.profile.updated` → Invalidate user profile cache
- `business.profile.updated` → Invalidate business profile cache

## Data Models

### Database Schema

#### users Table

```sql
CREATE TABLE users (
    user_uuid UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### conversations Table

```sql
CREATE TABLE conversations (
    conversation_uuid UUID PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group', 'business')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_uuid UUID REFERENCES messages(message_uuid)
);
```

#### participants Table

```sql
CREATE TABLE participants (
    conversation_uuid UUID REFERENCES conversations(conversation_uuid) ON DELETE CASCADE,
    user_uuid UUID REFERENCES users(user_uuid) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'agent', 'business', 'member', 'admin')),
    last_read_message_uuid UUID REFERENCES messages(message_uuid),
    is_muted BOOLEAN DEFAULT false,
    PRIMARY KEY(conversation_uuid, user_uuid)
);
```

#### messages Table

```sql
CREATE TABLE messages (
    message_uuid UUID PRIMARY KEY,
    conversation_uuid UUID REFERENCES conversations(conversation_uuid) ON DELETE CASCADE,
    sender_uuid UUID REFERENCES users(user_uuid),
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type VARCHAR(20) DEFAULT 'text',
    deleted_at TIMESTAMPTZ
);
```

### Redis Data Structures

#### Profile Cache

```
profile:user:{uuid} → HASH {name, avatar_url} (TTL: 24h)
profile:business:{uuid} → HASH {name, avatar_url} (TTL: 24h)
```

#### Real-time Data

```
presence:{uuid} → STRING "online" (TTL: 30s)
typing:{conversation_uuid}:{user_uuid} → STRING "typing" (TTL: 5s)
unread:{user_uuid}:{conversation_uuid} → STRING "3" (No TTL)
queue:{user_uuid} → LIST [message_uuid, ...] (No TTL)
```

## Error Handling

### Service Integration Errors

#### kaha-main-v3 Unavailable

- **Strategy**: Serve stale cached data, never block UI
- **Implementation**: Check Redis cache first, return cached data with staleness indicator
- **Fallback**: Display UUIDs with generic placeholder names if no cache available

#### Database Connection Issues

- **Strategy**: Implement connection pooling with retry logic
- **Implementation**: Use exponential backoff for reconnection attempts
- **Monitoring**: Log connection failures and alert on sustained outages

#### Redis Unavailable

- **Strategy**: Degrade gracefully, continue core messaging functionality
- **Implementation**: Skip caching operations, fetch profiles directly from kaha-main-v3
- **Impact**: Reduced performance but maintained functionality

### Message Delivery Guarantees

#### WebSocket Connection Loss

- **Strategy**: Queue messages in Redis for offline users
- **Implementation**: Store messages in user-specific Redis lists
- **Delivery**: Replay queued messages on reconnection

#### Duplicate Message Prevention

- **Strategy**: Use UUID-based message IDs for idempotency
- **Implementation**: Check for existing message UUID before insertion
- **Client-side**: Implement message deduplication based on UUID

## Testing Strategy

### Unit Testing

- **Message Service**: Test message creation, validation, and lifecycle
- **Conversation Service**: Test conversation creation and participant management
- **Profile Integration**: Mock kaha-main-v3 responses, test caching logic
- **Real-time Service**: Test WebSocket message broadcasting and presence updates

### Integration Testing

- **Database Operations**: Test all CRUD operations with actual PostgreSQL
- **Redis Operations**: Test caching and real-time data storage
- **External API**: Test kaha-main-v3 integration with mock server
- **WebSocket**: Test real-time message delivery and connection handling

### Performance Testing

- **Load Testing**: Simulate 50k concurrent users with realistic message patterns
- **Database Performance**: Test query performance with large datasets
- **Cache Performance**: Test Redis performance under high read/write loads
- **Memory Usage**: Monitor memory consumption during peak usage

### End-to-End Testing

- **Message Flow**: Test complete message journey from sender to receiver
- **Conversation Types**: Test all three conversation types (direct, group, business)
- **Real-time Features**: Test presence, typing indicators, and read receipts
- **Error Scenarios**: Test system behavior during various failure conditions

## Security Considerations

### Data Protection

- **Encryption at Rest**: Enable database-level encryption for message content
- **UUID Masking**: Never log raw UUIDs, use masked versions for debugging
- **Service Authentication**: Use service tokens for kaha-main-v3 communication

### Access Control

- **Conversation Ownership**: Validate user membership before allowing access
- **Business Chat Permissions**: Enforce agent permissions for business conversations
- **API Rate Limiting**: Implement rate limiting to prevent abuse

### Audit Trail

- **Message History**: Maintain soft delete for 7-day audit trail
- **Access Logging**: Log all conversation access attempts
- **Security Events**: Monitor and alert on suspicious activity patterns

## Performance Optimizations

### Database Optimizations

- **Indexing Strategy**: Create indexes on frequently queried columns
  - `messages(conversation_uuid, sent_at)` for message history
  - `participants(user_uuid)` for user conversations
  - `conversations(last_activity)` for conversation lists

### Caching Strategy

- **Profile Data**: 24-hour cache with background refresh
- **Conversation Lists**: Cache user's conversation list for 5 minutes
- **Message Pagination**: Cache recent message pages for 1 minute

### Real-time Optimizations

- **Connection Pooling**: Maintain WebSocket connection pools
- **Message Batching**: Batch multiple typing indicators to reduce traffic
- **Presence Aggregation**: Aggregate business presence from multiple agents

## Scalability Considerations

### Current Scale (50k Users)

- **Database**: Single PostgreSQL instance with read replicas
- **Redis**: Single Redis instance with persistence
- **Application**: Horizontal scaling with load balancer

### Future Scaling (100k+ Users)

- **Database Partitioning**: Implement time-based partitioning for messages table
- **Redis Clustering**: Move to Redis cluster for high availability
- **Message Storage**: Consider moving old messages to S3 for cost optimization

### Monitoring and Alerting

- **Performance Metrics**: Track message throughput, response times, error rates
- **Resource Monitoring**: Monitor CPU, memory, and database connection usage
- **Business Metrics**: Track active conversations, message volume, user engagement
