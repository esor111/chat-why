import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProfileService } from './profile.service';
import { RedisModule } from '../database/redis.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RedisModule,
  ],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}