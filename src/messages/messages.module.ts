import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from '../database/entities/message.entity';
import { Conversation } from '../database/entities/conversation.entity';
import { User } from '../database/entities/user.entity';
import { Participant } from '../database/entities/participant.entity';
import { ProfileModule } from '../profile/profile.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CommonModule } from '../common/common.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation, User, Participant]),
    ProfileModule,
    forwardRef(() => ConversationsModule),
    CommonModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}