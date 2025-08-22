# Authentication Module

This module provides JWT-based authentication for the chat microservice with automatic user creation functionality.

## Components

### 1. JWT Strategy (`jwt.strategy.ts`)
- Validates JWT tokens using the configured secret
- Extracts user information (id, kahaId) from token payload
- Returns `AuthenticatedUser` object for authenticated requests

### 2. Auth Guard (`auth.guard.ts`)
- Protects endpoints by requiring valid JWT tokens
- Extends Passport's JWT guard
- Throws unauthorized errors for invalid/missing tokens

### 3. Current User Decorator (`decorators/current-user.decorator.ts`)
- Extracts authenticated user information from request
- Use with `@CurrentUser()` parameter decorator
- Returns `AuthenticatedUser` object

### 4. User Creation Middleware (`middleware/user-creation.middleware.ts`)
- Automatically creates users in the database when they authenticate
- Runs on all routes before authentication
- Ensures users exist in chat-backend database based on JWT payload

### 5. Users Service (`../users/users.service.ts`)
- Handles user creation and management
- `ensureUserExists()` method creates users if they don't exist
- Updates kahaId if it changes

## Usage

### Protecting Endpoints

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, AuthenticatedUser } from '../auth';

@Controller('messages')
export class MessagesController {
  @Get()
  @UseGuards(AuthGuard)
  getMessages(@CurrentUser() user: AuthenticatedUser) {
    // user.id contains the user UUID
    // user.kahaId contains the kaha ID from main service
    return this.messagesService.getUserMessages(user.id);
  }
}
```

### JWT Token Format

The JWT token should contain the following payload:

```json
{
  "sub": "user-uuid-from-kaha-main-v3",
  "kahaId": "kaha-id-from-main-service",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Environment Variables

Required environment variables:

```env
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h
```

## Features

### Automatic User Creation
- When a user authenticates with a valid JWT token, the middleware automatically creates a user record in the chat database
- Users are identified by their UUID from kaha-main-v3
- The kahaId is stored for reference but profile data is fetched from the main service

### Token Validation
- Validates JWT signature using configured secret
- Checks token expiration
- Ensures required fields (sub, kahaId) are present

### Error Handling
- Graceful handling of invalid tokens
- Logging of authentication errors
- Non-blocking middleware (continues on errors, lets AuthGuard handle failures)

## Testing

Run authentication tests:

```bash
npm test -- --testPathPattern="auth|users"
```

## Integration

The authentication module is automatically configured in the main AppModule:

1. AuthModule provides JWT strategy and guards
2. UserCreationMiddleware runs on all routes
3. UsersModule handles user database operations

This ensures that any authenticated request automatically has the user available in the database and can be accessed via the `@CurrentUser()` decorator.