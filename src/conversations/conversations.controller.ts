import {
  Controller,
  Get,
  Post,
  Put,
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
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfileService } from '../profile/profile.service';
import { BusinessAccessGuard, BusinessRoles } from '../common/guards/business-access.guard';
import { ParticipantRole } from '../database/entities/participant.entity';
import {
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  CreateBusinessConversationDto,
  AddParticipantDto,
  UpdateParticipantRoleDto,
  ConversationResponseDto,
  ConversationListResponseDto,
} from './dto/conversation.dto';

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(AuthGuard, BusinessAccessGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly profileService: ProfileService,
  ) {}

  @Post('direct')
  @ApiOperation({ summary: 'Create a direct conversation between two users' })
  @ApiResponse({ status: 201, description: 'Direct conversation created', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createDirectConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createDirectConversationDto: CreateDirectConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationsService.createDirectConversation(
      user.id,
      createDirectConversationDto.targetUserId,
    );

    const enrichedConversations = await this.profileService.enrichConversationData([conversation]);
    return enrichedConversations[0];
  }

  @Post('group')
  @ApiOperation({ summary: 'Create a group conversation' })
  @ApiResponse({ status: 201, description: 'Group conversation created', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createGroupConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createGroupConversationDto: CreateGroupConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationsService.createGroupConversation(
      user.id,
      createGroupConversationDto.participantIds,
      createGroupConversationDto.name,
    );

    const enrichedConversations = await this.profileService.enrichConversationData([conversation]);
    return enrichedConversations[0];
  }

  @Post('business')
  @ApiOperation({ summary: 'Create a business conversation' })
  @ApiResponse({ status: 201, description: 'Business conversation created', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBusinessConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createBusinessConversationDto: CreateBusinessConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationsService.createBusinessConversation(
      user.id,
      createBusinessConversationDto.businessId,
      createBusinessConversationDto.agentId,
    );

    const enrichedConversations = await this.profileService.enrichConversationData([conversation]);
    return enrichedConversations[0];
  }

  @Get()
  @ApiOperation({ summary: 'Get user conversations with pagination' })
  @ApiResponse({ status: 200, description: 'User conversations retrieved', type: ConversationListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  async getUserConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<ConversationListResponseDto> {
    const result = await this.conversationsService.getUserConversations(user.id, page, limit);
    
    const enrichedConversations = await this.profileService.enrichConversationData(result.conversations);
    
    return {
      conversations: enrichedConversations,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation retrieved', type: ConversationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationsService.getConversation(conversationId, user.id);
    
    const enrichedConversations = await this.profileService.enrichConversationData([conversation]);
    return enrichedConversations[0];
  }

  @Post(':id/participants')
  @BusinessRoles(ParticipantRole.ADMIN, ParticipantRole.BUSINESS)
  @ApiOperation({ summary: 'Add participant to conversation' })
  @ApiResponse({ status: 201, description: 'Participant added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async addParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() addParticipantDto: AddParticipantDto,
  ) {
    return this.conversationsService.addParticipant(
      conversationId,
      user.id,
      addParticipantDto.userId,
      addParticipantDto.role,
    );
  }

  @Delete(':id/participants/:userId')
  @BusinessRoles(ParticipantRole.ADMIN, ParticipantRole.BUSINESS)
  @ApiOperation({ summary: 'Remove participant from conversation' })
  @ApiResponse({ status: 200, description: 'Participant removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Conversation or participant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid', description: 'User ID to remove' })
  async removeParticipant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('userId', ParseUUIDPipe) participantId: string,
  ) {
    return this.conversationsService.removeParticipant(conversationId, user.id, participantId);
  }

  @Put(':id/participants/:userId/role')
  @BusinessRoles(ParticipantRole.ADMIN, ParticipantRole.BUSINESS)
  @ApiOperation({ summary: 'Update participant role' })
  @ApiResponse({ status: 200, description: 'Participant role updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Conversation or participant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid', description: 'User ID to update' })
  async updateParticipantRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Param('userId', ParseUUIDPipe) participantId: string,
    @Body() updateRoleDto: UpdateParticipantRoleDto,
  ) {
    return this.conversationsService.updateParticipantRole(
      conversationId,
      user.id,
      participantId,
      updateRoleDto.role,
    );
  }

  @Get(':id/unread-count')
  @ApiOperation({ summary: 'Get unread message count for conversation' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    const unreadCounts = await this.conversationsService.getUnreadCounts(user.id);
    return {
      conversationId,
      unreadCount: unreadCounts[conversationId] || 0,
    };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() body: { messageId?: string },
  ) {
    await this.conversationsService.updateLastRead(conversationId, user.id, body.messageId);
    return { success: true };
  }

  @Put(':id/mute')
  @ApiOperation({ summary: 'Toggle mute status for conversation' })
  @ApiResponse({ status: 200, description: 'Mute status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async toggleMute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() body: { isMuted: boolean },
  ) {
    await this.conversationsService.toggleMute(conversationId, user.id, body.isMuted);
    return { success: true, isMuted: body.isMuted };
  }
}