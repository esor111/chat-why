import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  id: string; // User UUID
  kahaId: string; // Kaha ID from the main service
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string; // User UUID
  kahaId: string; // Kaha ID from the main service
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    console.log('payload', payload);
    if (!payload.id || !payload.kahaId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.id,
      kahaId: payload.kahaId,
    };
  }
}