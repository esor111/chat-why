import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1700000000000 implements MigrationInterface {
  name = 'InitialSetup1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kahaId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_kahaId" UNIQUE ("kahaId"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Create conversations table
    await queryRunner.query(`
      CREATE TYPE "conversation_type_enum" AS ENUM('direct', 'group', 'business');
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "conversation_type_enum" NOT NULL,
        "lastActivity" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastMessageId" uuid,
        "businessId" uuid,
        "name" varchar,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id")
      )
    `);

    // Create messages table
    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM('text', 'image', 'file', 'system');
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "type" "message_type_enum" NOT NULL DEFAULT 'text',
        "sentAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "senderId" uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id")
      )
    `);

    // Create participants table
    await queryRunner.query(`
      CREATE TYPE "participant_role_enum" AS ENUM('customer', 'agent', 'business', 'member', 'admin');
      CREATE TABLE "participants" (
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "participant_role_enum" NOT NULL DEFAULT 'member',
        "lastReadMessageId" uuid,
        "isMuted" boolean NOT NULL DEFAULT false,
        "lastReadAt" TIMESTAMP WITH TIME ZONE,
        "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_participants" PRIMARY KEY ("conversationId", "userId")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD CONSTRAINT "FK_messages_senderId" 
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "messages" 
      ADD CONSTRAINT "FK_messages_conversationId" 
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "conversations" 
      ADD CONSTRAINT "FK_conversations_lastMessageId" 
      FOREIGN KEY ("lastMessageId") REFERENCES "messages"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD CONSTRAINT "FK_participants_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD CONSTRAINT "FK_participants_conversationId" 
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "participants" 
      ADD CONSTRAINT "FK_participants_lastReadMessageId" 
      FOREIGN KEY ("lastReadMessageId") REFERENCES "messages"("id") ON DELETE SET NULL
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversationId_sentAt" 
      ON "messages" ("conversationId", "sentAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_participants_userId" 
      ON "participants" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_lastActivity" 
      ON "conversations" ("lastActivity")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_messages_deletedAt" 
      ON "messages" ("deletedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query('DROP INDEX "IDX_messages_deletedAt"');
    await queryRunner.query('DROP INDEX "IDX_conversations_lastActivity"');
    await queryRunner.query('DROP INDEX "IDX_participants_userId"');
    await queryRunner.query('DROP INDEX "IDX_messages_conversationId_sentAt"');

    // Drop foreign key constraints
    await queryRunner.query('ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_lastReadMessageId"');
    await queryRunner.query('ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_conversationId"');
    await queryRunner.query('ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_userId"');
    await queryRunner.query('ALTER TABLE "conversations" DROP CONSTRAINT "FK_conversations_lastMessageId"');
    await queryRunner.query('ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_conversationId"');
    await queryRunner.query('ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_senderId"');

    // Drop tables
    await queryRunner.query('DROP TABLE "participants"');
    await queryRunner.query('DROP TABLE "messages"');
    await queryRunner.query('DROP TABLE "conversations"');
    await queryRunner.query('DROP TABLE "users"');

    // Drop enums
    await queryRunner.query('DROP TYPE "participant_role_enum"');
    await queryRunner.query('DROP TYPE "message_type_enum"');
    await queryRunner.query('DROP TYPE "conversation_type_enum"');
  }
}