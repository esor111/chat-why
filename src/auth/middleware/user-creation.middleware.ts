import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../jwt.strategy';

@Injectable()
export class UserCreationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UserCreationMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.substring(7);
      if (!token) {
        return next();
      }

      // Verify and decode the JWT token
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.id || !payload.kahaId) {
        this.logger.warn('Invalid JWT payload: missing id or kahaId');
        return next();
      }

      // Ensure the user exists in our database
      // This is the main purpose of this middleware - auto-create users
      await this.usersService.ensureUserExists(payload.id, payload.kahaId);

    } catch (error) {
      // Log the error but don't block the request
      // The AuthGuard will handle authentication failures
      this.logger.warn(`User creation middleware error: ${error.message}`);
    }

    next();
  }
}