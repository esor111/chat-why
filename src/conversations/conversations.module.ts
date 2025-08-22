import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { Conversation } from '../database/entities/conversation.entity';
import { Participant } from '../database/entities/participant.entity';
import { Message } from '../database/entities/message.entity';
import { User } from '../database/entities/user.entity';
import { ProfileModule } from '../profile/profile.module';
import { CommonModule } from '../common/common.module';
import { BusinessAccessGuard } from '../common/guards/business-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Participant, Message, User]),
    ProfileModule,
    CommonModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, BusinessAccessGuard],
  exports: [ConversationsService, BusinessAccessGuard],
})
export class ConversationsModule {}