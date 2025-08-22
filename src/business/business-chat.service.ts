import { Injectable, Logger, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Conversation,
  ConversationType,
} from "../database/entities/conversation.entity";
import { ParticipantRole } from "../database/entities/participant.entity";
import { ConversationsService } from "../conversations/conversations.service";
import { AgentService } from "./agent.service";
import { BusinessHoursService } from "./business-hours.service";

export interface BusinessConversationRequest {
  customerId: string;
  businessId: string;
  initialMessage?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  category?: string;
}

export interface AgentAssignmentResult {
  agentId: string;
  assignmentMethod: "round_robin" | "least_busy" | "manual" | "skill_based";
  estimatedResponseTime?: number;
}

@Injectable()
export class BusinessChatService {
  private readonly logger = new Logger(BusinessChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
    private readonly agentService: AgentService,
    private readonly businessHoursService: BusinessHoursService
  ) {}

  /**
   * Create a business conversation with automatic agent assignment
   */
  async createBusinessConversation(
    request: BusinessConversationRequest
  ): Promise<{
    conversation: Conversation;
    assignment: AgentAssignmentResult | null;
  }> {
    try {
      // Check if business is within operating hours
      const isWithinHours =
        await this.businessHoursService.isWithinBusinessHours(
          request.businessId
        );

      if (!isWithinHours) {
        this.logger.warn(
          `Business conversation requested outside hours for business ${request.businessId}`
        );
      }

      // Check for existing active conversation between customer and business
      const existingConversation = await this.findActiveBusinessConversation(
        request.customerId,
        request.businessId
      );

      if (existingConversation) {
        this.logger.debug(
          `Returning existing business conversation ${existingConversation.id}`
        );

        // Get current agent assignment
        const agentParticipant = existingConversation.participants?.find(
          (p) => p.role === ParticipantRole.AGENT
        );

        const assignment = agentParticipant
          ? {
              agentId: agentParticipant.userId,
              assignmentMethod: "existing" as any,
            }
          : null;

        return { conversation: existingConversation, assignment };
      }

      // Create new business conversation
      const conversation =
        await this.conversationsService.createBusinessConversation(
          request.customerId,
          request.businessId
        );

      // Try to assign an agent
      let assignment: AgentAssignmentResult | null = null;

      if (isWithinHours) {
        assignment = await this.assignAgent(
          conversation.id,
          request.businessId,
          {
            priority: request.priority,
            category: request.category,
          }
        );
      } else {
        // Queue for later assignment when business hours resume
        await this.queueForLaterAssignment(conversation.id, request);
      }

      this.logger.log(
        `Created business conversation ${conversation.id} for business ${request.businessId}`
      );

      return { conversation, assignment };
    } catch (error) {
      this.logger.error(
        `Failed to create business conversation: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Assign an agent to a business conversation
   */
  async assignAgent(
    conversationId: string,
    businessId: string,
    options: {
      priority?: string;
      category?: string;
      preferredAgentId?: string;
    } = {}
  ): Promise<AgentAssignmentResult | null> {
    try {
      // Get available agents for the business
      const availableAgents = await this.agentService.getAvailableAgents(
        businessId
      );

      if (availableAgents.length === 0) {
        this.logger.warn(`No available agents for business ${businessId}`);
        return null;
      }

      let selectedAgent: any;
      let assignmentMethod: AgentAssignmentResult["assignmentMethod"];

      // Try preferred agent first
      if (options.preferredAgentId) {
        selectedAgent = availableAgents.find(
          (agent) => agent.id === options.preferredAgentId
        );
        if (selectedAgent) {
          assignmentMethod = "manual";
        }
      }

      // Skill-based assignment for specific categories
      if (!selectedAgent && options.category) {
        selectedAgent = await this.agentService.findAgentBySkill(
          businessId,
          options.category
        );
        if (selectedAgent) {
          assignmentMethod = "skill_based";
        }
      }

      // Least busy assignment for high priority
      if (
        (!selectedAgent && options.priority === "high") ||
        options.priority === "urgent"
      ) {
        selectedAgent = await this.agentService.getLeastBusyAgent(businessId);
        if (selectedAgent) {
          assignmentMethod = "least_busy";
        }
      }

      // Default to round-robin assignment
      if (!selectedAgent) {
        selectedAgent = await this.agentService.getNextRoundRobinAgent(
          businessId
        );
        assignmentMethod = "round_robin";
      }

      if (!selectedAgent) {
        this.logger.warn(
          `Could not assign agent for conversation ${conversationId}`
        );
        return null;
      }

      // Add agent as participant
      await this.conversationsService.addParticipant(
        conversationId,
        selectedAgent.id, // Using system user for agent assignment
        selectedAgent.id,
        ParticipantRole.AGENT
      );

      // Update agent's active conversation count
      await this.agentService.incrementActiveConversations(selectedAgent.id);

      // Get estimated response time
      const estimatedResponseTime =
        await this.agentService.getEstimatedResponseTime(selectedAgent.id);

      this.logger.log(
        `Assigned agent ${selectedAgent.id} to conversation ${conversationId} via ${assignmentMethod}`
      );

      return {
        agentId: selectedAgent.id,
        assignmentMethod,
        estimatedResponseTime,
      };
    } catch (error) {
      this.logger.error(
        `Failed to assign agent: ${error.message}`,
        error.stack
      );
      return null;
    }
  }

  /**
   * Reassign conversation to a different agent
   */
  async reassignAgent(
    conversationId: string,
    newAgentId: string,
    reassignedBy: string,
    _reason?: string
  ): Promise<void> {
    try {
      const conversation = await this.conversationsService.getConversation(
        conversationId,
        reassignedBy
      );

      if (conversation.type !== ConversationType.BUSINESS) {
        throw new BadRequestException(
          "Can only reassign business conversations"
        );
      }

      // Find current agent
      const currentAgentParticipant = conversation.participants.find(
        (p) => p.role === ParticipantRole.AGENT
      );

      if (currentAgentParticipant) {
        // Remove current agent
        await this.conversationsService.removeParticipant(
          conversationId,
          reassignedBy,
          currentAgentParticipant.userId
        );

        // Decrement current agent's active conversations
        await this.agentService.decrementActiveConversations(
          currentAgentParticipant.userId
        );
      }

      // Add new agent
      await this.conversationsService.addParticipant(
        conversationId,
        reassignedBy,
        newAgentId,
        ParticipantRole.AGENT
      );

      // Increment new agent's active conversations
      await this.agentService.incrementActiveConversations(newAgentId);

      this.logger.log(
        `Reassigned conversation ${conversationId} from ${currentAgentParticipant?.userId} to ${newAgentId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to reassign agent: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Handle agent going offline - reassign their conversations
   */
  async handleAgentOffline(agentId: string): Promise<void> {
    try {
      // Get agent's active business conversations
      const activeConversations = await this.getAgentActiveConversations(
        agentId
      );

      for (const conversation of activeConversations) {
        if (!conversation.businessId) continue;

        // Try to reassign to another available agent
        const assignment = await this.assignAgent(
          conversation.id,
          conversation.businessId,
          {
            priority: "high", // High priority for reassignment
          }
        );

        if (assignment) {
          // Remove offline agent
          await this.conversationsService.removeParticipant(
            conversation.id,
            agentId, // System removal
            agentId
          );

          this.logger.log(
            `Reassigned conversation ${conversation.id} due to agent ${agentId} going offline`
          );
        } else {
          // No available agents, queue for later assignment
          await this.queueForLaterAssignment(conversation.id, {
            customerId:
              conversation.participants.find(
                (p) => p.role === ParticipantRole.CUSTOMER
              )?.userId || "",
            businessId: conversation.businessId,
            priority: "high",
          });
        }
      }

      // Reset agent's active conversation count
      await this.agentService.resetActiveConversations(agentId);
    } catch (error) {
      this.logger.error(
        `Failed to handle agent offline: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get business conversation statistics
   */
  async getBusinessStats(businessId: string): Promise<{
    activeConversations: number;
    queuedConversations: number;
    averageResponseTime: number;
    availableAgents: number;
    totalAgents: number;
  }> {
    try {
      const [
        activeConversations,
        queuedConversations,
        averageResponseTime,
        agentStats,
      ] = await Promise.all([
        this.getActiveConversationsCount(businessId),
        this.getQueuedConversationsCount(businessId),
        this.agentService.getAverageResponseTime(businessId),
        this.agentService.getAgentStats(businessId),
      ]);

      return {
        activeConversations,
        queuedConversations,
        averageResponseTime,
        availableAgents: agentStats.available,
        totalAgents: agentStats.total,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get business stats: ${error.message}`,
        error.stack
      );
      return {
        activeConversations: 0,
        queuedConversations: 0,
        averageResponseTime: 0,
        availableAgents: 0,
        totalAgents: 0,
      };
    }
  }

  /**
   * Find existing active business conversation
   */
  private async findActiveBusinessConversation(
    customerId: string,
    businessId: string
  ): Promise<Conversation | null> {
    return await this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participants")
      .where("conversation.type = :type", { type: ConversationType.BUSINESS })
      .andWhere("conversation.businessId = :businessId", { businessId })
      .andWhere("participants.userId = :customerId", { customerId })
      .andWhere("participants.role = :role", { role: ParticipantRole.CUSTOMER })
      .getOne();
  }

  /**
   * Get agent's active business conversations
   */
  private async getAgentActiveConversations(
    agentId: string
  ): Promise<Conversation[]> {
    return await this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.participants", "participants")
      .where("conversation.type = :type", { type: ConversationType.BUSINESS })
      .andWhere("participants.userId = :agentId", { agentId })
      .andWhere("participants.role = :role", { role: ParticipantRole.AGENT })
      .getMany();
  }

  /**
   * Queue conversation for later agent assignment
   */
  private async queueForLaterAssignment(
    conversationId: string,
    _request: BusinessConversationRequest
  ): Promise<void> {
    // This would typically use a job queue like Bull/BullMQ
    // For now, we'll log it for manual handling
    this.logger.log(
      `Queued conversation ${conversationId} for later assignment`
    );
  }

  /**
   * Get active conversations count for a business
   */
  private async getActiveConversationsCount(
    businessId: string
  ): Promise<number> {
    return await this.conversationRepository
      .createQueryBuilder("conversation")
      .where("conversation.type = :type", { type: ConversationType.BUSINESS })
      .andWhere("conversation.businessId = :businessId", { businessId })
      .getCount();
  }

  /**
   * Get queued conversations count for a business
   */
  private async getQueuedConversationsCount(
    _businessId: string
  ): Promise<number> {
    // This would query the job queue for pending assignments
    // For now, return 0
    return 0;
  }
}
