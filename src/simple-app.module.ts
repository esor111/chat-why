import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimpleAppController } from './simple-app.controller';
import { SimpleAppService } from './simple-app.service';
import { SimpleAuthModule } from './simple-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'chat-meaw',
      entities: [],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    SimpleAuthModule,
  ],
  controllers: [SimpleAppController],
  providers: [SimpleAppService],
})
export class SimpleAppModule {}