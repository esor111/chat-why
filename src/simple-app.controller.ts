import { Controller, Get, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SimpleAppService } from './simple-app.service';
import * as jwt from 'jsonwebtoken';

@ApiTags('Chat API')
@Controller()
export class SimpleAppController {
  constructor(private readonly appService: SimpleAppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chat-backend',
      version: '1.0.0',
    };
  }

  @Get('auth/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: 200, description: 'Current user information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentUser(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Authorization header required', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      return {
        id: payload.id,
        kahaId: payload.kahaId,
        iat: payload.iat,
      };
    } catch (error) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('conversations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user conversations' })
  @ApiResponse({ status: 200, description: 'User conversations retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getConversations(@Headers('authorization') authHeader: string) {
    const user = this.validateToken(authHeader);
    
    return {
      conversations: [],
      total: 0,
      hasMore: false,
      page: 1,
      limit: 20,
      message: 'Conversations endpoint working - database integration pending'
    };
  }

  @Post('conversations/direct')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a direct conversation' })
  @ApiResponse({ status: 201, description: 'Direct conversation created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createDirectConversation(
    @Headers('authorization') authHeader: string,
    @Body() body: { targetUserId: string }
  ) {
    const user = this.validateToken(authHeader);
    
    return {
      id: 'mock-conversation-id',
      type: 'direct',
      participants: [user.id, body.targetUserId],
      createdAt: new Date().toISOString(),
      message: 'Direct conversation creation endpoint working - database integration pending'
    };
  }

  @Post('conversations/business')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a business conversation' })
  @ApiResponse({ status: 201, description: 'Business conversation created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createBusinessConversation(
    @Headers('authorization') authHeader: string,
    @Body() body: { businessId: string; initialMessage?: string }
  ) {
    const user = this.validateToken(authHeader);
    
    return {
      id: 'mock-business-conversation-id',
      type: 'business',
      businessId: body.businessId,
      customerId: user.id,
      initialMessage: body.initialMessage,
      createdAt: new Date().toISOString(),
      message: 'Business conversation creation endpoint working - database integration pending'
    };
  }

  @Get('notifications/unread-counts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread message counts' })
  @ApiResponse({ status: 200, description: 'Unread counts retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUnreadCounts(@Headers('authorization') authHeader: string) {
    const user = this.validateToken(authHeader);
    
    return {
      userId: user.id,
      unreadCounts: {},
      totalUnread: 0,
      message: 'Unread counts endpoint working - database integration pending'
    };
  }

  private validateToken(authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Authorization header required', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      return {
        id: payload.id,
        kahaId: payload.kahaId,
        iat: payload.iat,
      };
    } catch (error) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }
}