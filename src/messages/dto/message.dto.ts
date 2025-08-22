import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, IsNotEmpty, MaxLength, MinLength, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageType } from '../../database/entities/message.entity';
import { UserProfileDto } from '../../profile/dto/profile-response.dto';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  @MinLength(1, { message: 'Message content must be at least 1 character' })
  @MaxLength(4000, { message: 'Message content cannot exceed 4000 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  content: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    default: MessageType.TEXT
  })
  @IsOptional()
  @IsEnum(MessageType, { message: 'Invalid message type' })
  type?: MessageType = MessageType.TEXT;
}

export class SearchMessagesDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  @IsNotEmpty({ message: 'Search query cannot be empty' })
  @MinLength(1, { message: 'Search query must be at least 1 character' })
  @MaxLength(100, { message: 'Search query cannot exceed 100 characters' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  query: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  @Max(1000, { message: 'Page cannot exceed 1000' })
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @IsOptional()
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message UUID' })
  id: string;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiProperty({ description: 'Message type', enum: MessageType })
  type: MessageType;

  @ApiProperty({ description: 'When message was sent' })
  sentAt: Date;

  @ApiProperty({ description: 'Sender UUID' })
  senderId: string;

  @ApiProperty({ description: 'Conversation UUID' })
  conversationId: string;

  @ApiProperty({ description: 'When message was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When message was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'When message was deleted (if soft deleted)', required: false })
  deletedAt?: Date;

  @ApiProperty({ description: 'Sender profile information', required: false })
  sender?: UserProfileDto;
}

export class MessageListResponseDto {
  @ApiProperty({ description: 'Array of messages', type: [MessageResponseDto] })
  messages: MessageResponseDto[];

  @ApiProperty({ description: 'Total number of messages' })
  total: number;

  @ApiProperty({ description: 'Whether there are more messages available' })
  hasMore: boolean;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;
}