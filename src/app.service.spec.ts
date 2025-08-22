import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return health status', () => {
    const result = service.getHealth();
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
  });

  it('should return detailed health status', () => {
    const result = service.getDetailedHealth();
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('service', 'chat-backend');
    expect(result).toHaveProperty('version', '1.0.0');
    expect(result).toHaveProperty('uptime');
    expect(result).toHaveProperty('memory');
  });
});