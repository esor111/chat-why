import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsArray, IsEnum, IsNotEmpty, MaxLength, MinLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';
import { ParticipantRole } from '../../database/entities/participant.entity';
import { ConversationType } from '../../database/entities/conversation.entity';
import { UserProfileDto, BusinessProfileDto } from '../../profile/dto/profile-response.dto';

export class CreateDirectConversationDto {
  @ApiProperty({ description: 'Target user UUID for direct conversation' })
  @IsUUID(4, { message: 'Target user ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Target user ID is required' })
  targetUserId: string;
}

export class CreateGroupConversationDto {
  @ApiProperty({ description: 'Array of participant UUIDs (excluding creator)' })
  @IsArray({ message: 'Participant IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least 1 participant is required' })
  @ArrayMaxSize(7, { message: 'Maximum 7 participants allowed (excluding creator)' })
  @IsUUID(4, { each: true, message: 'Each participant ID must be a valid UUID' })
  participantIds: string[];

  @ApiProperty({ description: 'Optional group name', required: false })
  @IsOptional()
  @IsString({ message: 'Group name must be a string' })
  @MinLength(1, { message: 'Group name must be at least 1 character' })
  @MaxLength(100, { message: 'Group name cannot exceed 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name?: string;
}

export class CreateBusinessConversationDto {
  @ApiProperty({ description: 'Business UUID' })
  @IsUUID(4, { message: 'Business ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Business ID is required' })
  businessId: string;

  @ApiProperty({ description: 'Optional agent UUID', required: false })
  @IsOptional()
  @IsUUID(4, { message: 'Agent ID must be a valid UUID' })
  agentId?: string;
}

export class AddParticipantDto {
  @ApiProperty({ description: 'User UUID to add as participant' })
  @IsUUID(4, { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ 
    description: 'Participant role', 
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER 
  })
  @IsOptional()
  @IsEnum(ParticipantRole, { message: 'Invalid participant role' })
  role?: ParticipantRole = ParticipantRole.MEMBER;
}

export class UpdateParticipantRoleDto {
  @ApiProperty({ description: 'New participant role', enum: ParticipantRole })
  @IsEnum(ParticipantRole, { message: 'Invalid participant role' })
  @IsNotEmpty({ message: 'Role is required' })
  role: ParticipantRole;
}

export class ParticipantResponseDto {
  @ApiProperty({ description: 'User UUID' })
  userId: string;

  @ApiProperty({ description: 'Participant role', enum: ParticipantRole })
  role: ParticipantRole;

  @ApiProperty({ description: 'Last read message UUID', required: false })
  lastReadMessageId?: string;

  @ApiProperty({ description: 'Whether conversation is muted for this participant' })
  isMuted: boolean;

  @ApiProperty({ description: 'Last read timestamp', required: false })
  lastReadAt?: Date;

  @ApiProperty({ description: 'When participant joined the conversation' })
  joinedAt: Date;

  @ApiProperty({ description: 'User profile information', required: false })
  user?: UserProfileDto;
}

export class LastMessageResponseDto {
  @ApiProperty({ description: 'Message UUID' })
  id: string;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiProperty({ description: 'Message type' })
  type: string;

  @ApiProperty({ description: 'When message was sent' })
  sentAt: Date;

  @ApiProperty({ description: 'Sender UUID' })
  senderId: string;

  @ApiProperty({ description: 'Sender profile information', required: false })
  sender?: UserProfileDto;
}

export class ConversationResponseDto {
  @ApiProperty({ description: 'Conversation UUID' })
  id: string;

  @ApiProperty({ description: 'Conversation type', enum: ConversationType })
  type: ConversationType;

  @ApiProperty({ description: 'Last activity timestamp' })
  lastActivity: Date;

  @ApiProperty({ description: 'Conversation name (for group conversations)', required: false })
  name?: string;

  @ApiProperty({ description: 'Business UUID (for business conversations)', required: false })
  businessId?: string;

  @ApiProperty({ description: 'When conversation was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When conversation was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'Conversation participants', type: [ParticipantResponseDto] })
  participants: ParticipantResponseDto[];

  @ApiProperty({ description: 'Last message in conversation', required: false })
  lastMessage?: LastMessageResponseDto;

  @ApiProperty({ description: 'Business profile information (for business conversations)', required: false })
  business?: BusinessProfileDto;
}

export class ConversationListResponseDto {
  @ApiProperty({ description: 'Array of conversations', type: [ConversationResponseDto] })
  conversations: ConversationResponseDto[];

  @ApiProperty({ description: 'Total number of conversations' })
  total: number;

  @ApiProperty({ description: 'Whether there are more conversations available' })
  hasMore: boolean;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;
}