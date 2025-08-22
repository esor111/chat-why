import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthGuard],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw error when user is not authenticated', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    expect(() => {
      guard.handleRequest(null, null, null, mockContext);
    }).toThrow('Unauthorized');
  });

  it('should return user when authenticated', () => {
    const mockUser = { id: 'test-uuid', kahaId: 'test-kaha-id' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    const result = guard.handleRequest(null, mockUser, null, mockContext);
    expect(result).toEqual(mockUser);
  });
});