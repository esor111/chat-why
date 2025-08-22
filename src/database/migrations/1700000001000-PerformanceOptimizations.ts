import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceOptimizations1700000001000 implements MigrationInterface {
  name = 'PerformanceOptimizations1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Additional indexes for frequently queried columns
    
    // Users table optimizations
    await queryRunner.query(`
      CREATE INDEX "IDX_users_kahaId" 
      ON "users" ("kahaId")
    `);

    // Conversations table optimizations
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_type_lastActivity" 
      ON "conversations" ("type", "lastActivity" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_businessId" 
      ON "conversations" ("businessId") 
      WHERE "businessId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_lastMessageId" 
      ON "conversations" ("lastMessageId") 
      WHERE "lastMessageId" IS NOT NULL
    `);

    // Messages table optimizations
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_senderId_sentAt" 
      ON "messages" ("senderId", "sentAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_messages_type_sentAt" 
      ON "messages" ("type", "sentAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversationId_deletedAt_sentAt" 
      ON "messages" ("conversationId", "deletedAt", "sentAt" DESC)
    `);

    // Participants table optimizations
    await queryRunner.query(`
      CREATE INDEX "IDX_participants_conversationId_role" 
      ON "participants" ("conversationId", "role")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_participants_userId_joinedAt" 
      ON "participants" ("userId", "joinedAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_participants_lastReadMessageId" 
      ON "participants" ("lastReadMessageId") 
      WHERE "lastReadMessageId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_participants_isMuted" 
      ON "participants" ("isMuted") 
      WHERE "isMuted" = true
    `);

    // Composite indexes for complex queries
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversation_active" 
      ON "messages" ("conversationId", "sentAt" DESC) 
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_business_active" 
      ON "conversations" ("businessId", "lastActivity" DESC) 
      WHERE "type" = 'business'
    `);

    // Partial indexes for better performance on filtered queries
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_recent" 
      ON "messages" ("sentAt" DESC) 
      WHERE "sentAt" > NOW() - INTERVAL '30 days'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_active" 
      ON "conversations" ("lastActivity" DESC) 
      WHERE "lastActivity" > NOW() - INTERVAL '7 days'
    `);

    // Text search optimization for message content
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_content_gin" 
      ON "messages" USING gin(to_tsvector('english', "content"))
    `);

    // Statistics update for better query planning
    await queryRunner.query('ANALYZE "users"');
    await queryRunner.query('ANALYZE "conversations"');
    await queryRunner.query('ANALYZE "messages"');
    await queryRunner.query('ANALYZE "participants"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all performance optimization indexes
    await queryRunner.query('DROP INDEX "IDX_messages_content_gin"');
    await queryRunner.query('DROP INDEX "IDX_conversations_active"');
    await queryRunner.query('DROP INDEX "IDX_messages_recent"');
    await queryRunner.query('DROP INDEX "IDX_conversations_business_active"');
    await queryRunner.query('DROP INDEX "IDX_messages_conversation_active"');
    await queryRunner.query('DROP INDEX "IDX_participants_isMuted"');
    await queryRunner.query('DROP INDEX "IDX_participants_lastReadMessageId"');
    await queryRunner.query('DROP INDEX "IDX_participants_userId_joinedAt"');
    await queryRunner.query('DROP INDEX "IDX_participants_conversationId_role"');
    await queryRunner.query('DROP INDEX "IDX_messages_conversationId_deletedAt_sentAt"');
    await queryRunner.query('DROP INDEX "IDX_messages_type_sentAt"');
    await queryRunner.query('DROP INDEX "IDX_messages_senderId_sentAt"');
    await queryRunner.query('DROP INDEX "IDX_conversations_lastMessageId"');
    await queryRunner.query('DROP INDEX "IDX_conversations_businessId"');
    await queryRunner.query('DROP INDEX "IDX_conversations_type_lastActivity"');
    await queryRunner.query('DROP INDEX "IDX_users_kahaId"');
  }
}