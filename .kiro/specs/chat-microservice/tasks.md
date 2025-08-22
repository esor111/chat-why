# Implementation Plan

- [x] 1. Set up project structure and core configuration

  - Initialize NestJS project with TypeScript and essential dependencies
  - Configure PostgreSQL connection with UUID support
  - Configure Redis connection for caching and real-time features
  - Set up environment configuration and validation
  - _Requirements: 1.1, 1.3, 5.1, 5.4_

- [x] 2. Implement authentication and JWT handling

  - Create JWT strategy for token validation
  - Implement auth guard for protecting endpoints
  - Create CurrentUser decorator to extract user info from JWT token
  - Add middleware to auto-create users from JWT payload (id, kahaId)
  - _Requirements: 6.3, 6.4, 9.4_

- [x] 3. Create database entities and migrations
- [x] 3.1 Create User entity with auto-creation logic

  - Implement User entity with id (UUID), kahaId, createdAt, updatedAt
  - Create UsersService with ensureUserExists method
  - Write unit tests for user auto-creation logic
  - _Requirements: 1.1, 1.3_

- [x] 3.2 Create Conversation entity and relationships

  - Implement Conversation entity with UUID, type, timestamps
  - Add validation for conversation types (direct, group, business)
  - Create database migration for conversations table
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.3 Create Message entity with soft delete

  - Implement Message entity with UUID, content, timestamps, deletedAt
  - Add foreign key relationships to User and Conversation
  - Create database migration for messages table with indexes
  - _Requirements: 1.1, 1.6, 7.1_

- [x] 3.4 Create Participant entity for conversation membership

  - Implement Participant entity with composite primary key
  - Add role validation (customer, agent, business, member, admin)
  - Include lastReadMessageId and isMuted fields
  - _Requirements: 2.1, 2.2, 2.3, 7.2_

- [-] 4. Implement profile integration with kaha-main-v3
- [x] 4.1 Create ProfileService for external API integration

  - Implement HTTP client for kaha-main-v3 batch profile API
  - Create DTOs for profile API request/response
  - Add error handling for service unavailability
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.2 Implement Redis caching for profile data

  - Create caching layer for user and business profiles
  - Implement 24-hour TTL for profile cache
  - Add cache invalidation methods
  - _Requirements: 3.4, 5.1, 5.2, 5.4_

- [x] 4.3 Create profile enrichment functionality

  - Implement enrichConversationData method
  - Add batch profile fetching with fallback to cache
  - Handle graceful degradation when kaha-main-v3 is unavailable
  - _Requirements: 3.3, 3.5, 5.3_

- [x] 5. Implement core conversation management
- [x] 5.1 Create ConversationsService with CRUD operations

  - Implement createDirectConversation method
  - Implement createGroupConversation with participant limit validation
  - Implement createBusinessConversation with agent assignment
  - _Requirements: 2.1, 2.2, 2.3, 8.1, 8.2_

- [x] 5.2 Add participant management functionality

  - Implement addParticipant and removeParticipant methods
  - Add validation for group size limits (max 8 participants)
  - Create methods for updating participant roles and permissions
  - _Requirements: 2.1, 2.2, 6.4, 8.4_

- [x] 5.3 Create conversation listing and filtering

  - Implement getUserConversations with pagination
  - Add conversation search and filtering capabilities
  - Include last message and unread count in conversation list
  - _Requirements: 7.1, 7.4_

- [x] 6. Implement message handling system
- [x] 6.1 Create MessagesService with core functionality

  - Implement sendMessage method with auto-user creation
  - Add message validation and content sanitization
  - Create getMessages method with pagination support
  - _Requirements: 1.1, 1.2, 7.5_

- [x] 6.2 Add message lifecycle management

  - Implement soft delete functionality (deleteMessage)
  - Create background job for 90-day message retention
  - Add hard delete after 7-day audit period
  - _Requirements: 1.6, 6.1_

- [x] 6.3 Implement message queuing for offline users

  - Create Redis-based message queue system
  - Add message delivery confirmation mechanism
  - Implement message replay on user reconnection
  - _Requirements: 1.2, 5.3_

- [x] 7. Build real-time WebSocket functionality
- [x] 7.1 Create RealtimeGateway for WebSocket connections

  - Set up WebSocket gateway with authentication
  - Implement connection management and user session tracking
  - Add connection pooling and cleanup on disconnect
  - _Requirements: 4.1, 4.2_

- [x] 7.2 Implement presence system

  - Create presence tracking with 15-second heartbeat
  - Add automatic offline detection after 30 seconds
  - Implement business presence aggregation from agents
  - _Requirements: 4.1, 4.2, 8.3_

- [x] 7.3 Add typing indicators functionality

  - Implement typing start/stop event handling
  - Add 5-second auto-expiry for typing indicators
  - Create Redis-based typing state management
  - _Requirements: 4.3_

- [x] 7.4 Create read receipts system

  - Implement read receipt tracking and updates
  - Add lastReadMessageId synchronization
  - Create double-check status display logic
  - _Requirements: 4.3, 7.2_

- [x] 8. Implement business chat workflow
- [x] 8.1 Create business conversation routing

  - Implement business inbox message routing
  - Add agent assignment logic (round-robin or least busy)
  - Create business conversation creation workflow
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 8.2 Add agent management functionality

  - Implement agent availability tracking
  - Create agent assignment and reassignment methods
  - Add business hours enforcement logic
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 9. Create REST API controllers
- [x] 9.1 Implement ConversationsController

  - Create endpoints for conversation CRUD operations
  - Add conversation listing with profile enrichment
  - Implement participant management endpoints
  - _Requirements: 2.1, 2.2, 2.3, 3.1_

- [x] 9.2 Implement MessagesController

  - Create message sending and retrieval endpoints
  - Add message history with pagination
  - Implement message deletion endpoints
  - _Requirements: 1.1, 1.2, 1.6, 7.5_

- [x] 9.3 Add unread count and notification endpoints

  - Implement unread message count tracking
  - Create conversation muting/unmuting endpoints
  - Add notification preference management
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 10. Essential security and validation
- [x] 10.1 Add basic input validation and sanitization

  - Create DTOs with validation decorators for core endpoints
  - Implement message content sanitization
  - Add basic conversation ownership validation
  - _Requirements: 6.3, 6.4, 6.5_

- [x] 10.2 Implement core access control

  - Add conversation ownership validation
  - Implement business chat permission checks
  - Create basic audit logging for security events
  - _Requirements: 6.3, 6.4, 6.6_

- [x] 11. Basic testing
- [x] 11.1 Write essential unit tests

  - Test MessagesService core functionality
  - Test ConversationsService basic operations
  - Test ProfileService integration
  - Test basic WebSocket functionality
  - _Requirements: Core functionality validation_

- [x] 11.3 Basic integration testing

  - Test complete message flow from sender to receiver
  - Test all conversation types (direct, group, business)
  - Test basic real-time message delivery
  - Test error scenarios and graceful degradation
  - _Requirements: Core user-facing functionality_

- [ ] 12. Performance optimization and advanced features
- [x] 12.1 Add database performance optimizations

  - Create indexes for frequently queried columns
  - Implement query optimization for message history
  - Add database connection pooling configuration
  - _Requirements: 5.1, 10.1, 10.2_

- [ ] 12.2 Implement advanced caching strategies

  - Add conversation list caching (5-minute TTL)
  - Implement message pagination caching (1-minute TTL)
  - Create background cache refresh mechanisms
  - _Requirements: 5.2, 5.4_

- [ ] 12.3 Add advanced security measures

  - Enable database-level encryption for message content
  - Implement UUID masking in logs
  - Add rate limiting for API endpoints
  - Add database connection security configuration
  - _Requirements: 6.1, 6.2, 10.3_

- [ ] 13. Monitoring and scaling preparation
- [ ] 13.1 Add comprehensive testing suite

  - Write comprehensive unit tests for all services
  - Implement integration tests with actual PostgreSQL/Redis
  - Test kaha-main-v3 integration with mock server
  - Test WebSocket connections under load
  - _Requirements: All integration points_

- [ ] 13.2 Implement monitoring and alerting

  - Implement performance metrics tracking
  - Add resource monitoring (CPU, memory, connections)
  - Create business metrics dashboard
  - Set up alerting for system failures
  - _Requirements: 10.4, 10.5_

- [ ] 13.3 Final system integration and load testing
  - Test complete system with all components running
  - Verify kaha-main-v3 integration in staging environment
  - Perform load testing with simulated user traffic
  - Validate all real-time features under load
  - Implement graceful shutdown and error recovery
  - _Requirements: All system requirements_
