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
import { BusinessChatService } from './business-chat.service';
import { AgentService } from './agent.service';
import { BusinessHoursService } from './business-hours.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProfileService } from '../profile/profile.service';
import { BusinessAccessGuard, BusinessRoles } from '../common/guards/business-access.guard';
import { ParticipantRole } from '../database/entities/participant.entity';
import {
  CreateAdvancedBusinessConversationDto,
  AssignAgentDto,
  ReassignAgentDto,
  ConfigureAgentDto,
  SetBusinessHoursDto,
  BusinessStatsResponseDto,
  AgentResponseDto,
  AgentStatsResponseDto,
  BusinessHoursResponseDto,
} from './dto/business.dto';

@ApiTags('business')
@Controller('business')
@UseGuards(AuthGuard, BusinessAccessGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(
    private readonly businessChatService: BusinessChatService,
    private readonly agentService: AgentService,
    private readonly businessHoursService: BusinessHoursService,
    private readonly profileService: ProfileService,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a business conversation with automatic agent assignment' })
  @ApiResponse({ status: 201, description: 'Business conversation created', type: Object })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBusinessConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createDto: CreateAdvancedBusinessConversationDto,
  ) {
    const result = await this.businessChatService.createBusinessConversation({
      customerId: user.id,
      businessId: createDto.businessId,
      initialMessage: createDto.initialMessage,
      priority: createDto.priority,
      category: createDto.category,
    });

    const enrichedConversations = await this.profileService.enrichConversationData([result.conversation]);

    return {
      conversation: enrichedConversations[0],
      assignment: result.assignment,
    };
  }

  @Post('conversations/:conversationId/assign-agent')
  @BusinessRoles(ParticipantRole.BUSINESS, ParticipantRole.ADMIN)
  @ApiOperation({ summary: 'Manually assign an agent to a business conversation' })
  @ApiResponse({ status: 200, description: 'Agent assigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient business permissions' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async assignAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() assignDto: AssignAgentDto,
  ) {
    const assignment = await this.businessChatService.assignAgent(
      conversationId,
      assignDto.businessId,
      {
        preferredAgentId: assignDto.agentId,
        priority: assignDto.priority,
        category: assignDto.category,
      }
    );

    return { success: true, assignment };
  }

  @Put('conversations/:conversationId/reassign-agent')
  @BusinessRoles(ParticipantRole.BUSINESS, ParticipantRole.ADMIN)
  @ApiOperation({ summary: 'Reassign a conversation to a different agent' })
  @ApiResponse({ status: 200, description: 'Agent reassigned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient business permissions' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiParam({ name: 'conversationId', type: 'string', format: 'uuid', description: 'Conversation ID' })
  async reassignAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() reassignDto: ReassignAgentDto,
  ) {
    await this.businessChatService.reassignAgent(
      conversationId,
      reassignDto.newAgentId,
      user.id,
      reassignDto.reason
    );

    return { success: true };
  }

  @Get(':businessId/stats')
  @ApiOperation({ summary: 'Get business chat statistics' })
  @ApiResponse({ status: 200, description: 'Business statistics retrieved', type: BusinessStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async getBusinessStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<BusinessStatsResponseDto> {
    return await this.businessChatService.getBusinessStats(businessId);
  }

  @Get(':businessId/agents')
  @ApiOperation({ summary: 'Get available agents for a business' })
  @ApiResponse({ status: 200, description: 'Available agents retrieved', type: [AgentResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async getAvailableAgents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<AgentResponseDto[]> {
    return await this.agentService.getAvailableAgents(businessId);
  }

  @Get(':businessId/agents/stats')
  @ApiOperation({ summary: 'Get agent statistics for a business' })
  @ApiResponse({ status: 200, description: 'Agent statistics retrieved', type: AgentStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async getAgentStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<AgentStatsResponseDto> {
    return await this.agentService.getAgentStats(businessId);
  }

  @Post(':businessId/agents/:agentId')
  @ApiOperation({ summary: 'Add an agent to a business' })
  @ApiResponse({ status: 201, description: 'Agent added to business successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business or agent not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid', description: 'Agent ID' })
  async addAgentToBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
  ) {
    await this.agentService.addAgentToBusiness(businessId, agentId);
    return { success: true };
  }

  @Delete(':businessId/agents/:agentId')
  @ApiOperation({ summary: 'Remove an agent from a business' })
  @ApiResponse({ status: 200, description: 'Agent removed from business successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business or agent not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid', description: 'Agent ID' })
  async removeAgentFromBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
  ) {
    await this.agentService.removeAgentFromBusiness(businessId, agentId);
    return { success: true };
  }

  @Put('agents/:agentId/configure')
  @ApiOperation({ summary: 'Configure agent settings' })
  @ApiResponse({ status: 200, description: 'Agent configured successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid', description: 'Agent ID' })
  async configureAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Body() configDto: ConfigureAgentDto,
  ) {
    await this.agentService.configureAgent(agentId, {
      maxConcurrentChats: configDto.maxConcurrentChats,
      skills: configDto.skills,
      averageResponseTime: configDto.averageResponseTime,
    });

    return { success: true };
  }

  @Put('agents/:agentId/availability')
  @ApiOperation({ summary: 'Set agent availability status' })
  @ApiResponse({ status: 200, description: 'Agent availability updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid', description: 'Agent ID' })
  async setAgentAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Body() body: { isAvailable: boolean },
  ) {
    await this.agentService.setAgentAvailability(agentId, body.isAvailable);
    return { success: true, isAvailable: body.isAvailable };
  }

  @Get(':businessId/hours')
  @ApiOperation({ summary: 'Get business hours configuration' })
  @ApiResponse({ status: 200, description: 'Business hours retrieved', type: BusinessHoursResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async getBusinessHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<BusinessHoursResponseDto | null> {
    return await this.businessHoursService.getBusinessHours(businessId);
  }

  @Put(':businessId/hours')
  @ApiOperation({ summary: 'Set business hours configuration' })
  @ApiResponse({ status: 200, description: 'Business hours updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async setBusinessHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() hoursDto: SetBusinessHoursDto,
  ) {
    await this.businessHoursService.setBusinessHours({
      businessId,
      timezone: hoursDto.timezone,
      schedule: hoursDto.schedule,
      holidays: hoursDto.holidays || [],
      specialHours: hoursDto.specialHours || {},
    });

    return { success: true };
  }

  @Get(':businessId/hours/status')
  @ApiOperation({ summary: 'Check if business is currently open' })
  @ApiResponse({ status: 200, description: 'Business hours status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async getBusinessHoursStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    const [isOpen, nextOpeningTime, timeUntilOpen] = await Promise.all([
      this.businessHoursService.isWithinBusinessHours(businessId),
      this.businessHoursService.getNextOpeningTime(businessId),
      this.businessHoursService.getTimeUntilOpen(businessId),
    ]);

    return {
      businessId,
      isOpen,
      nextOpeningTime,
      timeUntilOpen,
    };
  }

  @Post(':businessId/hours/holidays')
  @ApiOperation({ summary: 'Add a holiday to business calendar' })
  @ApiResponse({ status: 201, description: 'Holiday added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  async addHoliday(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { date: string; name?: string },
  ) {
    await this.businessHoursService.addHoliday(businessId, body.date);
    return { success: true };
  }

  @Delete(':businessId/hours/holidays/:date')
  @ApiOperation({ summary: 'Remove a holiday from business calendar' })
  @ApiResponse({ status: 200, description: 'Holiday removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business or holiday not found' })
  @ApiParam({ name: 'businessId', type: 'string', format: 'uuid', description: 'Business ID' })
  @ApiParam({ name: 'date', type: 'string', description: 'Holiday date (YYYY-MM-DD)' })
  async removeHoliday(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('date') date: string,
  ) {
    await this.businessHoursService.removeHoliday(businessId, date);
    return { success: true };
  }
}