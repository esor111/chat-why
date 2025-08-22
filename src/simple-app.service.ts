import { Injectable } from '@nestjs/common';

@Injectable()
export class SimpleAppService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'chat-backend-simple',
      version: '1.0.0',
    };
  }
}