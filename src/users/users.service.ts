import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Ensures a user exists in the database, creating them if they don't exist
   * This method is called automatically when a user is authenticated via JWT
   */
  async ensureUserExists(userId: string, kahaId: string): Promise<User> {
    try {
      // First try to find the user by their UUID
      let user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (user) {
        // Update kahaId if it has changed
        if (user.kahaId !== kahaId) {
          user.kahaId = kahaId;
          user = await this.userRepository.save(user);
          this.logger.log(`Updated kahaId for user ${userId}`);
        }
        return user;
      }

      // User doesn't exist, create them
      user = this.userRepository.create({
        id: userId,
        kahaId: kahaId,
      });

      user = await this.userRepository.save(user);
      this.logger.log(`Created new user ${userId} with kahaId ${kahaId}`);
      
      return user;
    } catch (error) {
      this.logger.error(`Failed to ensure user exists: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find a user by their UUID
   */
  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  /**
   * Find a user by their kahaId
   */
  async findByKahaId(kahaId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { kahaId: kahaId },
    });
  }
}