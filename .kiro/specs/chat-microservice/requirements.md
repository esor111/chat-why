# Requirements Document

## Introduction

This document outlines the requirements for a chat microservice (chat-backend) that enables real-time messaging capabilities for a platform serving 50k-100k users. The system supports 1:1 messaging, small group chats (max 8 participants), and business-to-user communication with 90-day message retention. The microservice integrates with an existing user/business service (kaha-main-v3) and follows a UUID-based architecture with strict data ownership principles.

## Requirements

### Requirement 1: Core Messaging Infrastructure

**User Story:** As a platform user, I want to send and receive messages in real-time, so that I can communicate effectively with other users and businesses.

#### Acceptance Criteria

1. WHEN a user sends a message THEN the system SHALL store the message with a UUID identifier and timestamp
2. WHEN a message is sent THEN the system SHALL deliver it to all conversation participants in real-time
3. WHEN storing messages THEN the system SHALL use UUID v4 for all identifiers (users, conversations, messages)
4. WHEN a conversation is created THEN the system SHALL assign it a unique UUID identifier
5. IF a message is older than 90 days THEN the system SHALL soft delete it by setting deleted_at timestamp
6. IF a soft-deleted message is older than 7 days THEN the system SHALL hard delete it from the database

### Requirement 2: Conversation Types Support

**User Story:** As a user, I want to participate in different types of conversations (1:1, group, business), so that I can communicate in various contexts.

#### Acceptance Criteria

1. WHEN creating a 1:1 conversation THEN the system SHALL allow exactly 2 participants
2. WHEN creating a group conversation THEN the system SHALL allow 2-8 participants maximum
3. WHEN a user messages a business THEN the system SHALL create a business conversation with user, business, and assigned agent
4. WHEN assigning an agent to business conversation THEN the system SHALL use round-robin or least busy strategy
5. WHEN displaying conversation names THEN the system SHALL use other user's name for 1:1, first 3 participants for group, and business name for business chats

### Requirement 3: Profile Data Integration

**User Story:** As a system administrator, I want the chat service to fetch user/business profile data from the main service, so that data consistency is maintained across services.

#### Acceptance Criteria

1. WHEN displaying user information THEN the system SHALL fetch names and avatars from kaha-main-v3 via batch API
2. WHEN storing user data THEN the system SHALL ONLY store user UUIDs, never profile information
3. WHEN kaha-main-v3 is unavailable THEN the system SHALL serve stale cached profile data
4. WHEN profile data is updated in kaha-main-v3 THEN the system SHALL invalidate relevant Redis cache keys
5. IF batch profile API call fails THEN the system SHALL continue operation with cached or fallback data

### Requirement 4: Basic Real-time Messaging

**User Story:** As a user, I want to send and receive messages in real-time, so that I can have immediate conversations.

#### Acceptance Criteria

1. WHEN a user sends a message THEN the system SHALL deliver it to conversation participants via WebSocket
2. WHEN a user connects via WebSocket THEN the system SHALL establish a stable connection
3. WHEN a WebSocket connection drops THEN the system SHALL attempt to reconnect automatically
4. WHEN a user is offline THEN the system SHALL queue messages for delivery when they reconnect
5. WHEN displaying messages THEN the system SHALL show them in chronological order

### Requirement 5: Message Management

**User Story:** As a user, I want to see unread message counts and manage my conversation history, so that I can stay organized and catch up on missed messages.

#### Acceptance Criteria

1. WHEN receiving new messages THEN the system SHALL increment unread count for conversation participants
2. WHEN user reads messages THEN the system SHALL reset unread count for that conversation
3. WHEN user mutes a conversation THEN the system SHALL not send push notifications for new messages
4. WHEN displaying conversation list THEN the system SHALL show last message and timestamp
5. WHEN user requests message history THEN the system SHALL return messages in chronological order

### Requirement 6: Data Security and Access Control

**User Story:** As a platform administrator, I want to ensure user data is secure and access is properly controlled, so that user privacy is protected.

#### Acceptance Criteria

1. WHEN storing messages THEN the system SHALL encrypt content at rest using database-level encryption
2. WHEN logging system activity THEN the system SHALL mask UUIDs to prevent exposure
3. WHEN making API calls between services THEN the system SHALL use service tokens for authentication
4. WHEN accessing chat endpoints THEN the system SHALL validate user ownership of conversations
5. WHEN accessing business chats THEN the system SHALL enforce agent permissions

### Requirement 7: Business Chat Workflow

**User Story:** As a business customer, I want to communicate with business representatives through the platform, so that I can get support and information.

#### Acceptance Criteria

1. WHEN a user messages a business THEN the system SHALL create a conversation and add it to business inbox
2. WHEN a business conversation is created THEN the system SHALL assign an available agent as third participant
3. WHEN displaying business presence THEN the system SHALL aggregate status from agent availability
4. WHEN business hours are enforced THEN the system SHALL route messages according to availability rules
5. WHEN agent joins conversation THEN the system SHALL maintain message history from conversation start

### Requirement 8: Real-time Features

**User Story:** As a user, I want to see when others are online, typing, and have read my messages, so that I have context about conversation activity.

#### Acceptance Criteria

1. WHEN a user connects via WebSocket THEN the system SHALL mark them as online with 15-second heartbeat
2. WHEN no heartbeat is received for 30 seconds THEN the system SHALL mark user as offline
3. WHEN a user starts typing THEN the system SHALL broadcast typing indicator to conversation participants
4. WHEN typing indicator is not updated for 5 seconds THEN the system SHALL auto-expire it
5. WHEN a user scrolls to bottom of conversation THEN the system SHALL update their last_read_message_uuid
6. WHEN displaying messages THEN the system SHALL show read receipts as double-checks for read messages

### Requirement 9: Profile Data Integration

**User Story:** As a system administrator, I want the chat service to fetch user/business profile data from the main service, so that data consistency is maintained across services.

#### Acceptance Criteria

1. WHEN displaying user information THEN the system SHALL fetch names and avatars from kaha-main-v3 via batch API
2. WHEN storing user data THEN the system SHALL ONLY store user UUIDs, never profile information
3. WHEN kaha-main-v3 is unavailable THEN the system SHALL serve stale cached profile data
4. WHEN profile data is updated in kaha-main-v3 THEN the system SHALL invalidate relevant Redis cache keys
5. IF batch profile API call fails THEN the system SHALL continue operation with cached or fallback data

### Requirement 10: System Integration

**User Story:** As a system integrator, I want the chat service to properly integrate with existing services, so that the overall platform works cohesively.

#### Acceptance Criteria

1. WHEN kaha-main-v3 provides batch profile API THEN the system SHALL use POST /api/batch/profiles endpoint
2. WHEN receiving profile update events THEN the system SHALL invalidate corresponding cache entries
3. WHEN looking up users/businesses THEN the system SHALL support UUID-based queries to kaha-main-v3
4. WHEN service starts THEN the system SHALL establish connection to PostgreSQL with UUID support
5. WHEN service starts THEN the system SHALL establish connection to Redis instance with 256MB+ capacity

### Requirement 11: Caching and Performance Optimization

**User Story:** As a system user, I want fast response times when viewing conversations and messages, so that the chat experience feels responsive.

#### Acceptance Criteria

1. WHEN fetching profile data THEN the system SHALL cache user profiles in Redis for 24 hours
2. WHEN fetching profile data THEN the system SHALL cache business profiles in Redis for 24 hours
3. WHEN user is offline THEN the system SHALL queue messages in Redis for delivery
4. WHEN building UI responses THEN the system SHALL batch fetch missing profile data from kaha-main-v3
5. WHEN serving 50k users THEN the system SHALL handle ~50 SQL writes/sec and ~500 Redis writes/sec

### Requirement 12: Scalability and Monitoring

**User Story:** As a system administrator, I want the chat service to scale efficiently and provide monitoring capabilities, so that I can maintain service quality as usage grows.

#### Acceptance Criteria

1. WHEN serving 100k active users THEN the system SHALL support adding PostgreSQL read replicas
2. WHEN serving 500k active users THEN the system SHALL implement time-based partitioning
3. WHEN serving 1M+ users THEN the system SHALL move message content to S3 while keeping metadata in SQL
4. WHEN system experiences high load THEN the system SHALL maintain response times under acceptable thresholds
5. WHEN errors occur THEN the system SHALL log appropriate information for debugging and monitoring