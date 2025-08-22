import { Injectable, Logger } from '@nestjs/common';

export enum AuditEventType {
  CONVERSATION_ACCESS = 'conversation_access',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_DELETED = 'message_deleted',
  PARTICIPANT_ADDED = 'participant_added',
  PARTICIPANT_REMOVED = 'participant_removed',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  VALIDATION_FAILED = 'validation_failed',
  BUSINESS_CONVERSATION_CREATED = 'business_conversation_created',
  AGENT_ASSIGNED = 'agent_assigned',
}

export interface AuditEvent {
  type: AuditEventType;
  userId: string;
  conversationId?: string;
  messageId?: string;
  targetUserId?: string;
  businessId?: string;
  agentId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Log a security audit event
   */
  logEvent(event: Omit<AuditEvent, 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Mask sensitive UUIDs for logging
    const maskedEvent = this.maskSensitiveData(auditEvent);

    // Log the event (in production, this would go to a secure audit log)
    this.logger.log(`AUDIT: ${JSON.stringify(maskedEvent)}`);

    // In production, you might want to:
    // 1. Send to a dedicated audit logging service
    // 2. Store in a separate audit database
    // 3. Send to SIEM systems
    // 4. Trigger alerts for suspicious patterns
  }

  /**
   * Log conversation access attempt
   */
  logConversationAccess(
    userId: string,
    conversationId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): void {
    this.logEvent({
      type: success ? AuditEventType.CONVERSATION_ACCESS : AuditEventType.UNAUTHORIZED_ACCESS,
      userId,
      conversationId,
      metadata: { success },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log message operations
   */
  logMessageOperation(
    type: AuditEventType.MESSAGE_SENT | AuditEventType.MESSAGE_DELETED,
    userId: string,
    conversationId: string,
    messageId: string,
    metadata?: Record<string, any>,
  ): void {
    this.logEvent({
      type,
      userId,
      conversationId,
      messageId,
      metadata,
    });
  }

  /**
   * Log participant management operations
   */
  logParticipantOperation(
    type: AuditEventType.PARTICIPANT_ADDED | AuditEventType.PARTICIPANT_REMOVED,
    userId: string,
    conversationId: string,
    targetUserId: string,
    metadata?: Record<string, any>,
  ): void {
    this.logEvent({
      type,
      userId,
      conversationId,
      targetUserId,
      metadata,
    });
  }

  /**
   * Log business conversation operations
   */
  logBusinessOperation(
    type: AuditEventType.BUSINESS_CONVERSATION_CREATED | AuditEventType.AGENT_ASSIGNED,
    userId: string,
    conversationId: string,
    businessId: string,
    agentId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.logEvent({
      type,
      userId,
      conversationId,
      businessId,
      agentId,
      metadata,
    });
  }

  /**
   * Log validation failures
   */
  logValidationFailure(
    userId: string,
    endpoint: string,
    errors: string[],
    ipAddress?: string,
    userAgent?: string,
  ): void {
    this.logEvent({
      type: AuditEventType.VALIDATION_FAILED,
      userId,
      metadata: {
        endpoint,
        errors,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Mask sensitive UUIDs in audit logs
   */
  private maskSensitiveData(event: AuditEvent): AuditEvent {
    const masked = { ...event };

    // Mask UUIDs to show only first 8 characters
    if (masked.userId) {
      masked.userId = this.maskUUID(masked.userId);
    }
    if (masked.conversationId) {
      masked.conversationId = this.maskUUID(masked.conversationId);
    }
    if (masked.messageId) {
      masked.messageId = this.maskUUID(masked.messageId);
    }
    if (masked.targetUserId) {
      masked.targetUserId = this.maskUUID(masked.targetUserId);
    }
    if (masked.businessId) {
      masked.businessId = this.maskUUID(masked.businessId);
    }
    if (masked.agentId) {
      masked.agentId = this.maskUUID(masked.agentId);
    }

    return masked;
  }

  /**
   * Mask UUID to show only first 8 characters
   */
  private maskUUID(uuid: string): string {
    if (!uuid || uuid.length < 8) {
      return '****-****';
    }
    return `${uuid.substring(0, 8)}-****`;
  }
}