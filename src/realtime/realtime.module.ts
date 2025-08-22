import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PresenceService } from './presence.service';
import { TypingService } from './typing.service';
import { ReadReceiptService } from './read-receipt.service';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../database/redis.module';
import { Participant } from '../database/entities/participant.entity';
import { Message } from '../database/entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Participant, Message]),
    AuthModule, 
    RedisModule
  ],
  providers: [
    RealtimeGateway, 
    RealtimeService, 
    PresenceService, 
    TypingService, 
    ReadReceiptService
  ],
  exports: [
    RealtimeService, 
    PresenceService, 
    TypingService, 
    ReadReceiptService,
    RealtimeGateway
  ],
})
export class RealtimeModule {}