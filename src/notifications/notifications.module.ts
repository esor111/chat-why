import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    forwardRef(() => ConversationsModule),
    forwardRef(() => MessagesModule),
    RealtimeModule,
  ],
  controllers: [NotificationsController],
})
export class NotificationsModule {}