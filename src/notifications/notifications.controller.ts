import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ConversationsService } from '../conversations/conversations.service';
import { ReadReceiptService } from '../realtime/read-receipt.service';
import { MessagesService } from '../messages/messages.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly readReceiptService: ReadReceiptService,
    private readonly messagesService: MessagesService,
  ) {}

  @Get('unread-counts')
  @ApiOperation({ summary: 'Get unread message counts for all user conversations' })
  @ApiResponse({ status: 200, description: 'Unread counts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCounts(@CurrentUser() user: AuthenticatedUser) {
    const unreadCounts = await this.readReceiptService.getAllUnreadCounts(user.id);
    
    return {
      userId: user.id,
      unreadCounts,
      totalUnread: Object.values(unreadCounts).reduce((sum, count) => sum + count, 0),
    };
  }

  @Get('conversations/:conversationId/unread-count')
  @ApiOperation({ summary: 'Get unread message count for a specific conversation' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getConversationUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    const unreadCount = await this.readReceiptService.getUnreadCount(user.id, conversationId);
    
    return {
      conversationId,
      unreadCount,
    };
  }

  @Put('conversations/:conversationId/mark-read')
  @ApiOperation({ summary: 'Mark all messages in a conversation as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async markConversationAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: { messageId?: string },
  ) {
    if (body.messageId) {
      await this.readReceiptService.markAsRead(user.id, conversationId, body.messageId);
    } else {
      await this.readReceiptService.markAllAsRead(user.id, conversationId);
    }
    
    return { success: true };
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all messages in all conversations as read' })
  @ApiResponse({ status: 200, description: 'All messages marked as read successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    // Get all user conversations
    const { conversations } = await this.conversationsService.getUserConversations(user.id, 1, 1000);
    
    // Mark all conversations as read
    const promises = conversations.map(conversation =>
      this.readReceiptService.markAllAsRead(user.id, conversation.id)
    );
    
    await Promise.all(promises);
    
    return { 
      success: true, 
      markedConversations: conversations.length 
    };
  }

  @Get('conversations/:conversationId/read-receipts')
  @ApiOperation({ summary: 'Get read receipts for messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Read receipts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getConversationReadReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('limit') limit: number = 50,
  ) {
    // Verify user is participant
    await this.conversationsService.getConversation(conversationId, user.id);
    
    // Get recent messages
    const { messages } = await this.messagesService.getMessages(conversationId, user.id, 1, limit);
    const messageIds = messages.map(m => m.id);
    
    // Get read status for all messages
    const readStatuses = await this.readReceiptService.getBulkMessageReadStatus(messageIds);
    
    return {
      conversationId,
      readStatuses,
    };
  }

  @Get('messages/:messageId/read-receipts')
  @ApiOperation({ summary: 'Get read receipts for a specific message' })
  @ApiResponse({ status: 200, description: 'Read receipts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiParam({ name: 'messageId', type: 'string', format: 'uuid', description: 'Message ID' })
  async getMessageReadReceipts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    // Verify user can access this message
    await this.messagesService.getMessage(messageId, user.id);
    
    const readReceipts = await this.readReceiptService.getMessageReadReceipts(messageId);
    
    return {
      messageId,
      readReceipts,
    };
  }

  @Get('conversations/:conversationId/last-read')
  @ApiOperation({ summary: 'Get last read message for user in a conversation' })
  @ApiResponse({ status: 200, description: 'Last read message retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getLastReadMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    const lastReadMessage = await this.readReceiptService.getLastReadMessage(user.id, conversationId);
    
    return {
      conversationId,
      lastReadMessage,
    };
  }

  @Put('conversations/:conversationId/mute')
  @ApiOperation({ summary: 'Toggle mute status for a conversation' })
  @ApiResponse({ status: 200, description: 'Mute status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async toggleMute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: { isMuted: boolean },
  ) {
    await this.conversationsService.toggleMute(conversationId, user.id, body.isMuted);
    
    return { 
      success: true, 
      conversationId,
      isMuted: body.isMuted 
    };
  }
}