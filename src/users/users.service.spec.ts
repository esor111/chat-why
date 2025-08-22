import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from '../database/entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureUserExists', () => {
    it('should return existing user if found', async () => {
      const existingUser = {
        id: 'test-uuid',
        kahaId: 'test-kaha-id',
      } as User;

      mockRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.ensureUserExists('test-uuid', 'test-kaha-id');

      expect(result).toEqual(existingUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
    });

    it('should create new user if not found', async () => {
      const newUser = {
        id: 'test-uuid',
        kahaId: 'test-kaha-id',
      } as User;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newUser);
      mockRepository.save.mockResolvedValue(newUser);

      const result = await service.ensureUserExists('test-uuid', 'test-kaha-id');

      expect(result).toEqual(newUser);
      expect(mockRepository.create).toHaveBeenCalledWith({
        id: 'test-uuid',
        kahaId: 'test-kaha-id',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newUser);
    });

    it('should update kahaId if it has changed', async () => {
      const existingUser = {
        id: 'test-uuid',
        kahaId: 'old-kaha-id',
      } as User;

      const updatedUser = {
        id: 'test-uuid',
        kahaId: 'new-kaha-id',
      } as User;

      mockRepository.findOne.mockResolvedValue(existingUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.ensureUserExists('test-uuid', 'new-kaha-id');

      expect(result.kahaId).toBe('new-kaha-id');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const user = { id: 'test-uuid', kahaId: 'test-kaha-id' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findById('test-uuid');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      });
    });
  });

  describe('findByKahaId', () => {
    it('should find user by kahaId', async () => {
      const user = { id: 'test-uuid', kahaId: 'test-kaha-id' } as User;
      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findByKahaId('test-kaha-id');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { kahaId: 'test-kaha-id' },
      });
    });
  });
});