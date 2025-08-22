import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfileService } from '../profile/profile.service';
import {
  SendMessageDto,
  MessageResponseDto,
  MessageListResponseDto,
} from './dto/message.dto';

@ApiTags('messages')
@Controller('conversations/:conversationId/messages')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly profileService: ProfileService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.messagesService.sendMessage(
      conversationId,
      user.id,
      sendMessageDto.content,
      sendMessageDto.type,
    );

    const enrichedMessages = await this.profileService.enrichMessageData([message]);
    const enrichedMessage = enrichedMessages[0];

    // Broadcast enriched message to all participants in real-time
    await this.messagesService.broadcastEnrichedMessage(conversationId, enrichedMessage);

    return enrichedMessage;
  }

  @Get()
  @ApiOperation({ summary: 'Get messages for a conversation with pagination' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully', type: MessageListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ): Promise<MessageListResponseDto> {
    const result = await this.messagesService.getMessages(conversationId, user.id, page, limit);
    
    const enrichedMessages = await this.profileService.enrichMessageData(result.messages);
    
    return {
      messages: enrichedMessages,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Search results retrieved', type: MessageListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiQuery({ name: 'q', type: 'string', description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  async searchMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('q') query: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<MessageListResponseDto> {
    const result = await this.messagesService.searchMessages(
      conversationId,
      user.id,
      query,
      page,
      limit,
    );
    
    const enrichedMessages = await this.profileService.enrichMessageData(result.messages);
    
    return {
      messages: enrichedMessages,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    };
  }

  @Get(':messageId')
  @ApiOperation({ summary: 'Get a specific message by ID' })
  @ApiResponse({ status: 200, description: 'Message retrieved successfully', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiParam({ name: 'messageId', type: 'string', format: 'uuid', description: 'Message ID' })
  async getMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messagesService.getMessage(messageId, user.id);
    
    const enrichedMessages = await this.profileService.enrichMessageData([message]);
    return enrichedMessages[0];
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete a message (soft delete)' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only delete own messages' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiParam({ name: 'messageId', type: 'string', format: 'uuid', description: 'Message ID' })
  async deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    await this.messagesService.deleteMessage(messageId, user.id);
    return { success: true };
  }

  @Get('since/:timestamp')
  @ApiOperation({ summary: 'Get messages since a specific timestamp (for real-time sync)' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully', type: [MessageResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiParam({ name: 'timestamp', type: 'string', description: 'ISO timestamp' })
  async getMessagesSince(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('timestamp') timestamp: string,
  ): Promise<MessageResponseDto[]> {
    const since = new Date(timestamp);
    const messages = await this.messagesService.getMessagesSince(conversationId, user.id, since);
    
    return this.profileService.enrichMessageData(messages);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get total message count for conversation' })
  @ApiResponse({ status: 200, description: 'Message count retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getMessageCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    const count = await this.messagesService.getMessageCount(conversationId, user.id);
    return { conversationId, messageCount: count };
  }
}