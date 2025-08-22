import { ApiProperty } from '@nestjs/swagger';
import { 
  IsUUID, 
  IsString, 
  IsOptional, 
  IsArray, 
  IsEnum, 
  IsBoolean, 
  IsNumber, 
  IsObject,
  ValidateNested,
  Min,
  Max
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ConversationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreateAdvancedBusinessConversationDto {
  @ApiProperty({ description: 'Business UUID' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ description: 'Initial message content', required: false })
  @IsOptional()
  @IsString()
  initialMessage?: string;

  @ApiProperty({ 
    description: 'Conversation priority', 
    enum: ConversationPriority,
    required: false,
    default: ConversationPriority.NORMAL
  })
  @IsOptional()
  @IsEnum(ConversationPriority)
  priority?: ConversationPriority;

  @ApiProperty({ description: 'Conversation category/topic', required: false })
  @IsOptional()
  @IsString()
  category?: string;
}

export class AssignAgentDto {
  @ApiProperty({ description: 'Business UUID' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ description: 'Agent UUID to assign' })
  @IsUUID()
  agentId: string;

  @ApiProperty({ 
    description: 'Assignment priority', 
    enum: ConversationPriority,
    required: false
  })
  @IsOptional()
  @IsEnum(ConversationPriority)
  priority?: ConversationPriority;

  @ApiProperty({ description: 'Assignment category', required: false })
  @IsOptional()
  @IsString()
  category?: string;
}

export class ReassignAgentDto {
  @ApiProperty({ description: 'New agent UUID' })
  @IsUUID()
  newAgentId: string;

  @ApiProperty({ description: 'Reason for reassignment', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConfigureAgentDto {
  @ApiProperty({ 
    description: 'Maximum concurrent chats for agent', 
    required: false,
    minimum: 1,
    maximum: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxConcurrentChats?: number;

  @ApiProperty({ 
    description: 'Agent skills/categories', 
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ 
    description: 'Average response time in seconds', 
    required: false,
    minimum: 30
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  averageResponseTime?: number;
}

export class DayScheduleDto {
  @ApiProperty({ description: 'Whether business is open on this day' })
  @IsBoolean()
  isOpen: boolean;

  @ApiProperty({ description: 'Opening time (HH:MM format)' })
  @IsString()
  openTime: string;

  @ApiProperty({ description: 'Closing time (HH:MM format)' })
  @IsString()
  closeTime: string;

  @ApiProperty({ 
    description: 'Break times during the day', 
    required: false,
    type: [Object]
  })
  @IsOptional()
  @IsArray()
  breaks?: Array<{
    startTime: string;
    endTime: string;
  }>;
}

export class SpecialHoursDto {
  @ApiProperty({ description: 'Whether business is open on this special date' })
  @IsBoolean()
  isOpen: boolean;

  @ApiProperty({ description: 'Special opening time (HH:MM format)', required: false })
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiProperty({ description: 'Special closing time (HH:MM format)', required: false })
  @IsOptional()
  @IsString()
  closeTime?: string;
}

export class SetBusinessHoursDto {
  @ApiProperty({ description: 'Business timezone (e.g., America/New_York)' })
  @IsString()
  timezone: string;

  @ApiProperty({ 
    description: 'Weekly schedule',
    type: Object,
    example: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      // ... other days
    }
  })
  @IsObject()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  schedule: {
    [key: string]: DayScheduleDto;
  };

  @ApiProperty({ 
    description: 'Holiday dates (YYYY-MM-DD format)', 
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holidays?: string[];

  @ApiProperty({ 
    description: 'Special hours for specific dates', 
    required: false,
    type: Object
  })
  @IsOptional()
  @IsObject()
  specialHours?: { [date: string]: SpecialHoursDto };
}

// Response DTOs
export class BusinessStatsResponseDto {
  @ApiProperty({ description: 'Number of active conversations' })
  activeConversations: number;

  @ApiProperty({ description: 'Number of queued conversations' })
  queuedConversations: number;

  @ApiProperty({ description: 'Average response time in seconds' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Number of available agents' })
  availableAgents: number;

  @ApiProperty({ description: 'Total number of agents' })
  totalAgents: number;
}

export class AgentResponseDto {
  @ApiProperty({ description: 'Agent UUID' })
  id: string;

  @ApiProperty({ description: 'Agent name' })
  name: string;

  @ApiProperty({ description: 'Agent email', required: false })
  email?: string;

  @ApiProperty({ description: 'Agent skills', type: [String] })
  skills: string[];

  @ApiProperty({ description: 'Maximum concurrent chats' })
  maxConcurrentChats: number;

  @ApiProperty({ description: 'Current active chats' })
  currentActiveChats: number;

  @ApiProperty({ description: 'Average response time in seconds' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Whether agent is available' })
  isAvailable: boolean;

  @ApiProperty({ description: 'Last active timestamp' })
  lastActiveAt: Date;
}

export class AgentStatsResponseDto {
  @ApiProperty({ description: 'Total number of agents' })
  total: number;

  @ApiProperty({ description: 'Number of available agents' })
  available: number;

  @ApiProperty({ description: 'Number of busy agents' })
  busy: number;

  @ApiProperty({ description: 'Number of offline agents' })
  offline: number;
}

export class BusinessHoursResponseDto {
  @ApiProperty({ description: 'Business UUID' })
  businessId: string;

  @ApiProperty({ description: 'Business timezone' })
  timezone: string;

  @ApiProperty({ description: 'Weekly schedule' })
  schedule: {
    [key: string]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
      breaks?: Array<{
        startTime: string;
        endTime: string;
      }>;
    };
  };

  @ApiProperty({ description: 'Holiday dates', type: [String] })
  holidays: string[];

  @ApiProperty({ description: 'Special hours for specific dates' })
  specialHours: {
    [date: string]: {
      isOpen: boolean;
      openTime?: string;
      closeTime?: string;
    };
  };
}