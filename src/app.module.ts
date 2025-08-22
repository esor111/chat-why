import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProfileModule } from "./profile/profile.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { MessagesModule } from "./messages/messages.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { BusinessModule } from "./business/business.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { configValidationSchema } from "./config/config.validation";
import { UserCreationMiddleware } from "./auth/middleware/user-creation.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      envFilePath: [".env.local", ".env"],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    ConversationsModule,
    MessagesModule,
    RealtimeModule,
    BusinessModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserCreationMiddleware).forRoutes("*"); // Apply to all routes
  }
}
