import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/database/entities/user.entity';
import { Conversation } from './src/database/entities/conversation.entity';
import { Message } from './src/database/entities/message.entity';
import { Participant } from './src/database/entities/participant.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'chat_backend',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Conversation, Message, Participant],
  migrations: ['src/database/migrations/*.ts'],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
