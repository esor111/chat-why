import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { TypingService } from './typing.service';
import { ReadReceiptService } from './read-receipt.service';
import { JwtPayload } from '../auth/jwt.strategy';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  kahaId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly typingService: TypingService,
    private readonly readReceiptService: ReadReceiptService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake auth
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.id || !payload.kahaId) {
        this.logger.warn(`Client ${client.id} has invalid token payload`);
        client.disconnect();
        return;
      }

      // Store user info on socket
      client.userId = payload.id;
      client.kahaId = payload.kahaId;

      // Set user as online
      await this.presenceService.setUserOnline(client.userId);

      // Join user to their personal room for direct messaging
      await client.join(`user:${client.userId}`);

      this.logger.log(`User ${client.userId} connected via WebSocket`);

      // Send connection confirmation
      client.emit('connected', {
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Failed to authenticate WebSocket connection: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      try {
        // Set user as offline
        await this.presenceService.setUserOffline(client.userId);

        // Stop all typing indicators for this user
        await this.typingService.stopAllTypingForUser(client.userId);

        this.logger.log(`User ${client.userId} disconnected from WebSocket`);
      } catch (error) {
        this.logger.error(`Error during disconnect for user ${client.userId}: ${error.message}`);
      }
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.userId) {
      await this.presenceService.updateHeartbeat(client.userId);
      client.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data.conversationId) {
      return;
    }

    try {
      // Join conversation room
      await client.join(`conversation:${data.conversationId}`);
      
      this.logger.debug(`User ${client.userId} joined conversation ${data.conversationId}`);
      
      client.emit('joined_conversation', {
        conversationId: data.conversationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to join conversation: ${error.message}`);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data.conversationId) {
      return;
    }

    try {
      // Leave conversation room
      await client.leave(`conversation:${data.conversationId}`);
      
      // Stop typing indicator if active
      await this.typingService.stopTyping(client.userId, data.conversationId);
      
      this.logger.debug(`User ${client.userId} left conversation ${data.conversationId}`);
      
      client.emit('left_conversation', {
        conversationId: data.conversationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to leave conversation: ${error.message}`);
    }
  }

  @SubscribeMessage('start_typing')
  async handleStartTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data.conversationId) {
      return;
    }

    try {
      await this.typingService.startTyping(client.userId, data.conversationId);
      
      // Broadcast typing indicator to other participants
      client.to(`conversation:${data.conversationId}`).emit('typing_start', {
        userId: client.userId,
        conversationId: data.conversationId,
        userName: `User ${client.userId.substring(0, 8)}`, // Add user name for display
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to start typing indicator: ${error.message}`);
    }
  }

  @SubscribeMessage('stop_typing')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data.conversationId) {
      return;
    }

    try {
      await this.typingService.stopTyping(client.userId, data.conversationId);
      
      // Broadcast stop typing to other participants
      client.to(`conversation:${data.conversationId}`).emit('typing_stop', {
        userId: client.userId,
        conversationId: data.conversationId,
        userName: `User ${client.userId.substring(0, 8)}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to stop typing indicator: ${error.message}`);
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    if (!client.userId || !data.conversationId || !data.messageId) {
      return;
    }

    try {
      await this.readReceiptService.markAsRead(client.userId, data.conversationId, data.messageId);
      
      // Broadcast read receipt to other participants
      client.to(`conversation:${data.conversationId}`).emit('message_read', {
        userId: client.userId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`);
    }
  }

  @SubscribeMessage('get_presence')
  async handleGetPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userIds: string[] },
  ) {
    if (!client.userId || !data.userIds) {
      return;
    }

    try {
      const presences = await this.presenceService.getBulkPresence(data.userIds);
      
      client.emit('presence_update', {
        presences,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to get presence: ${error.message}`);
    }
  }

  /**
   * Broadcast new message to conversation participants
   */
  async broadcastMessage(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit('new_message', {
      ...message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast conversation update to participants
   */
  async broadcastConversationUpdate(conversationId: string, update: any) {
    this.server.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      ...update,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to specific user
   */
  async sendUserNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast presence update to all connected clients
   */
  async broadcastPresenceUpdate(userId: string, status: string) {
    this.server.emit('presence_update', {
      userId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}