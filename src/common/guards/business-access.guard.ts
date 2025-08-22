import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConversationsService } from '../../conversations/conversations.service';
import { ParticipantRole } from '../../database/entities/participant.entity';
import { ConversationType } from '../../database/entities/conversation.entity';
import { AuditService, AuditEventType } from '../services/audit.service';

export const BUSINESS_ROLES = 'business_roles';
export const BusinessRoles = (...roles: ParticipantRole[]) => {
  const { SetMetadata } = require('@nestjs/common');
  return SetMetadata(BUSINESS_ROLES, roles);
};

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(forwardRef(() => ConversationsService))
    private readonly conversationsService: ConversationsService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ParticipantRole[]>(BUSINESS_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No specific business roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const conversationId = request.params.conversationId;

    if (!user || !conversationId) {
      return true; // Let other guards handle authentication/validation
    }

    try {
      // Get conversation and check if user is participant
      const conversation = await this.conversationsService.getConversation(conversationId, user.id);

      // Only apply business role checks to business conversations
      if (conversation.type !== ConversationType.BUSINESS) {
        return true;
      }

      // Find user's role in this business conversation
      const userParticipant = conversation.participants.find(p => p.userId === user.id);
      
      if (!userParticipant) {
        this.auditService.logConversationAccess(user.id, conversationId, false);
        throw new ForbiddenException('You are not a participant in this business conversation');
      }

      // Check if user has required business role
      const hasRequiredRole = requiredRoles.includes(userParticipant.role);
      
      if (!hasRequiredRole) {
        this.auditService.logEvent({
          type: AuditEventType.UNAUTHORIZED_ACCESS,
          userId: user.id,
          conversationId,
          metadata: {
            requiredRoles,
            userRole: userParticipant.role,
            reason: 'Insufficient business conversation permissions',
          },
        });
        
        throw new ForbiddenException(`Business conversation access denied. Required roles: ${requiredRoles.join(', ')}`);
      }

      // Log successful access
      this.auditService.logEvent({
        type: AuditEventType.CONVERSATION_ACCESS,
        userId: user.id,
        conversationId,
        metadata: {
          userRole: userParticipant.role,
          conversationType: conversation.type,
        },
      });

      return true;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      // Log unexpected errors
      this.auditService.logEvent({
        type: AuditEventType.UNAUTHORIZED_ACCESS,
        userId: user.id,
        conversationId,
        metadata: {
          error: error.message,
          reason: 'Business access check failed',
        },
      });
      
      throw new ForbiddenException('Business conversation access check failed');
    }
  }
}