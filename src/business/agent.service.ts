import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';
import { User } from '../database/entities/user.entity';
import { Participant } from '../database/entities/participant.entity';
import { PresenceService, PresenceStatus } from '../realtime/presence.service';

export interface Agent {
  id: string;
  name: string;
  email?: string;
  skills: string[];
  maxConcurrentChats: number;
  currentActiveChats: number;
  averageResponseTime: number;
  isAvailable: boolean;
  lastActiveAt: Date;
}

export interface AgentStats {
  total: number;
  available: number;
  busy: number;
  offline: number;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly presenceService: PresenceService,
  ) {}

  /**
   * Get available agents for a business
   */
  async getAvailableAgents(businessId: string): Promise<Agent[]> {
    try {
      // Get all agents for the business (this would typically come from a business-agent relationship table)
      const agentIds = await this.getBusinessAgentIds(businessId);
      
      const agents: Agent[] = [];
      
      for (const agentId of agentIds) {
        const agent = await this.getAgentDetails(agentId);
        if (agent && agent.isAvailable) {
          agents.push(agent);
        }
      }

      return agents.sort((a, b) => a.currentActiveChats - b.currentActiveChats);
    } catch (error) {
      this.logger.error(`Failed to get available agents: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get agent details with current status
   */
  async getAgentDetails(agentId: string): Promise<Agent | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: agentId },
      });

      if (!user) {
        return null;
      }

      // Get agent's current stats from Redis
      const agentData = await this.redis.hgetall(`agent:${agentId}`);
      
      // Get presence status
      const presence = await this.presenceService.getUserPresence(agentId);
      const isOnline = presence?.status === PresenceStatus.ONLINE;

      // Get current active chats count
      const currentActiveChats = await this.getCurrentActiveChats(agentId);
      
      const maxConcurrentChats = parseInt(agentData.maxConcurrentChats || '5');
      const averageResponseTime = parseInt(agentData.averageResponseTime || '300'); // 5 minutes default
      
      const isAvailable = isOnline && 
                         currentActiveChats < maxConcurrentChats &&
                         (agentData.status !== 'unavailable');

      return {
        id: agentId,
        name: user.kahaId || `User ${agentId}`,
        skills: agentData.skills ? JSON.parse(agentData.skills) : [],
        maxConcurrentChats,
        currentActiveChats,
        averageResponseTime,
        isAvailable,
        lastActiveAt: presence?.lastSeen || user.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get agent details: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Find agent by skill/category
   */
  async findAgentBySkill(businessId: string, skill: string): Promise<Agent | null> {
    try {
      const availableAgents = await this.getAvailableAgents(businessId);
      
      // Find agents with the required skill
      const skilledAgents = availableAgents.filter(agent => 
        agent.skills.includes(skill.toLowerCase())
      );

      if (skilledAgents.length === 0) {
        return null;
      }

      // Return the least busy skilled agent
      return skilledAgents.sort((a, b) => a.currentActiveChats - b.currentActiveChats)[0];
    } catch (error) {
      this.logger.error(`Failed to find agent by skill: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get least busy agent
   */
  async getLeastBusyAgent(businessId: string): Promise<Agent | null> {
    try {
      const availableAgents = await this.getAvailableAgents(businessId);
      
      if (availableAgents.length === 0) {
        return null;
      }

      // Return agent with least active chats
      return availableAgents.sort((a, b) => a.currentActiveChats - b.currentActiveChats)[0];
    } catch (error) {
      this.logger.error(`Failed to get least busy agent: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get next agent using round-robin assignment
   */
  async getNextRoundRobinAgent(businessId: string): Promise<Agent | null> {
    try {
      const availableAgents = await this.getAvailableAgents(businessId);
      
      if (availableAgents.length === 0) {
        return null;
      }

      // Get current round-robin index
      const key = `business:${businessId}:round_robin_index`;
      const currentIndex = await this.redis.get(key);
      const index = currentIndex ? parseInt(currentIndex) : 0;
      
      // Get next agent
      const nextAgent = availableAgents[index % availableAgents.length];
      
      // Update round-robin index
      await this.redis.set(key, (index + 1) % availableAgents.length, 'EX', 86400); // 24 hour expiry
      
      return nextAgent;
    } catch (error) {
      this.logger.error(`Failed to get round-robin agent: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Increment agent's active conversation count
   */
  async incrementActiveConversations(agentId: string): Promise<void> {
    try {
      const key = `agent:${agentId}:active_chats`;
      await this.redis.incr(key);
      await this.redis.expire(key, 86400); // 24 hour expiry
      
      this.logger.debug(`Incremented active chats for agent ${agentId}`);
    } catch (error) {
      this.logger.error(`Failed to increment active conversations: ${error.message}`, error.stack);
    }
  }

  /**
   * Decrement agent's active conversation count
   */
  async decrementActiveConversations(agentId: string): Promise<void> {
    try {
      const key = `agent:${agentId}:active_chats`;
      const current = await this.redis.get(key);
      
      if (current && parseInt(current) > 0) {
        await this.redis.decr(key);
      }
      
      this.logger.debug(`Decremented active chats for agent ${agentId}`);
    } catch (error) {
      this.logger.error(`Failed to decrement active conversations: ${error.message}`, error.stack);
    }
  }

  /**
   * Reset agent's active conversation count
   */
  async resetActiveConversations(agentId: string): Promise<void> {
    try {
      const key = `agent:${agentId}:active_chats`;
      await this.redis.del(key);
      
      this.logger.debug(`Reset active chats for agent ${agentId}`);
    } catch (error) {
      this.logger.error(`Failed to reset active conversations: ${error.message}`, error.stack);
    }
  }

  /**
   * Get estimated response time for an agent
   */
  async getEstimatedResponseTime(agentId: string): Promise<number> {
    try {
      const agentData = await this.redis.hgetall(`agent:${agentId}`);
      const baseResponseTime = parseInt(agentData.averageResponseTime || '300'); // 5 minutes
      
      const currentActiveChats = await this.getCurrentActiveChats(agentId);
      
      // Increase estimated time based on current load
      const loadMultiplier = 1 + (currentActiveChats * 0.3); // 30% increase per active chat
      
      return Math.round(baseResponseTime * loadMultiplier);
    } catch (error) {
      this.logger.error(`Failed to get estimated response time: ${error.message}`, error.stack);
      return 300; // Default 5 minutes
    }
  }

  /**
   * Update agent's average response time
   */
  async updateAverageResponseTime(agentId: string, responseTime: number): Promise<void> {
    try {
      const key = `agent:${agentId}`;
      const agentData = await this.redis.hgetall(key);
      
      const currentAverage = parseInt(agentData.averageResponseTime || '300');
      const responseCount = parseInt(agentData.responseCount || '1');
      
      // Calculate new average using exponential moving average
      const alpha = 0.1; // Smoothing factor
      const newAverage = Math.round(currentAverage * (1 - alpha) + responseTime * alpha);
      
      await this.redis.hset(key, {
        averageResponseTime: newAverage,
        responseCount: responseCount + 1,
      });
      
      this.logger.debug(`Updated average response time for agent ${agentId}: ${newAverage}s`);
    } catch (error) {
      this.logger.error(`Failed to update average response time: ${error.message}`, error.stack);
    }
  }

  /**
   * Set agent availability status
   */
  async setAgentAvailability(agentId: string, isAvailable: boolean): Promise<void> {
    try {
      const key = `agent:${agentId}`;
      await this.redis.hset(key, {
        status: isAvailable ? 'available' : 'unavailable',
        lastStatusChange: new Date().toISOString(),
      });
      
      this.logger.log(`Set agent ${agentId} availability to ${isAvailable ? 'available' : 'unavailable'}`);
    } catch (error) {
      this.logger.error(`Failed to set agent availability: ${error.message}`, error.stack);
    }
  }

  /**
   * Configure agent settings
   */
  async configureAgent(agentId: string, config: {
    maxConcurrentChats?: number;
    skills?: string[];
    averageResponseTime?: number;
  }): Promise<void> {
    try {
      const key = `agent:${agentId}`;
      const updateData: any = {};
      
      if (config.maxConcurrentChats !== undefined) {
        updateData.maxConcurrentChats = config.maxConcurrentChats;
      }
      
      if (config.skills !== undefined) {
        updateData.skills = JSON.stringify(config.skills.map(s => s.toLowerCase()));
      }
      
      if (config.averageResponseTime !== undefined) {
        updateData.averageResponseTime = config.averageResponseTime;
      }
      
      await this.redis.hset(key, updateData);
      
      this.logger.log(`Configured agent ${agentId} settings`);
    } catch (error) {
      this.logger.error(`Failed to configure agent: ${error.message}`, error.stack);
    }
  }

  /**
   * Get agent statistics for a business
   */
  async getAgentStats(businessId: string): Promise<AgentStats> {
    try {
      const agentIds = await this.getBusinessAgentIds(businessId);
      
      let total = 0;
      let available = 0;
      let busy = 0;
      let offline = 0;
      
      for (const agentId of agentIds) {
        total++;
        
        const agent = await this.getAgentDetails(agentId);
        if (!agent) {
          offline++;
          continue;
        }
        
        const presence = await this.presenceService.getUserPresence(agentId);
        
        if (presence?.status === PresenceStatus.ONLINE) {
          if (agent.isAvailable) {
            available++;
          } else {
            busy++;
          }
        } else {
          offline++;
        }
      }
      
      return { total, available, busy, offline };
    } catch (error) {
      this.logger.error(`Failed to get agent stats: ${error.message}`, error.stack);
      return { total: 0, available: 0, busy: 0, offline: 0 };
    }
  }

  /**
   * Get average response time for a business
   */
  async getAverageResponseTime(businessId: string): Promise<number> {
    try {
      const agentIds = await this.getBusinessAgentIds(businessId);
      
      let totalResponseTime = 0;
      let agentCount = 0;
      
      for (const agentId of agentIds) {
        const agentData = await this.redis.hgetall(`agent:${agentId}`);
        if (agentData.averageResponseTime) {
          totalResponseTime += parseInt(agentData.averageResponseTime);
          agentCount++;
        }
      }
      
      return agentCount > 0 ? Math.round(totalResponseTime / agentCount) : 300;
    } catch (error) {
      this.logger.error(`Failed to get average response time: ${error.message}`, error.stack);
      return 300;
    }
  }

  /**
   * Get current active chats count for an agent
   */
  private async getCurrentActiveChats(agentId: string): Promise<number> {
    try {
      const key = `agent:${agentId}:active_chats`;
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error(`Failed to get current active chats: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Get agent IDs for a business (mock implementation)
   */
  private async getBusinessAgentIds(businessId: string): Promise<string[]> {
    try {
      // In a real implementation, this would query a business-agent relationship table
      // For now, we'll use Redis to store business agent assignments
      const key = `business:${businessId}:agents`;
      const agentIds = await this.redis.smembers(key);
      
      return agentIds;
    } catch (error) {
      this.logger.error(`Failed to get business agent IDs: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Add agent to business
   */
  async addAgentToBusiness(businessId: string, agentId: string): Promise<void> {
    try {
      const key = `business:${businessId}:agents`;
      await this.redis.sadd(key, agentId);
      
      this.logger.log(`Added agent ${agentId} to business ${businessId}`);
    } catch (error) {
      this.logger.error(`Failed to add agent to business: ${error.message}`, error.stack);
    }
  }

  /**
   * Remove agent from business
   */
  async removeAgentFromBusiness(businessId: string, agentId: string): Promise<void> {
    try {
      const key = `business:${businessId}:agents`;
      await this.redis.srem(key, agentId);
      
      this.logger.log(`Removed agent ${agentId} from business ${businessId}`);
    } catch (error) {
      this.logger.error(`Failed to remove agent from business: ${error.message}`, error.stack);
    }
  }
}