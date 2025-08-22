import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessChatService } from './business-chat.service';
import { AgentService } from './agent.service';
import { BusinessHoursService } from './business-hours.service';
import { BusinessController } from './business.controller';
import { Conversation } from '../database/entities/conversation.entity';
import { Participant } from '../database/entities/participant.entity';
import { User } from '../database/entities/user.entity';
import { ConversationsModule } from '../conversations/conversations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RedisModule } from '../database/redis.module';
import { ProfileModule } from '../profile/profile.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Participant,
      User,
    ]),
    forwardRef(() => ConversationsModule),
    RealtimeModule,
    RedisModule,
    ProfileModule,
    CommonModule,
  ],
  controllers: [BusinessController],
  providers: [
    BusinessChatService,
    AgentService,
    BusinessHoursService,
  ],
  exports: [
    BusinessChatService,
    AgentService,
    BusinessHoursService,
  ],
})
export class BusinessModule {}