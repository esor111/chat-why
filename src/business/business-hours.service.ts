import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../database/redis.module';

export interface BusinessHours {
  businessId: string;
  timezone: string;
  schedule: {
    [key: string]: { // 'monday', 'tuesday', etc.
      isOpen: boolean;
      openTime: string; // '09:00'
      closeTime: string; // '17:00'
      breaks?: Array<{
        startTime: string;
        endTime: string;
      }>;
    };
  };
  holidays: string[]; // Array of dates in 'YYYY-MM-DD' format
  specialHours: {
    [date: string]: { // 'YYYY-MM-DD'
      isOpen: boolean;
      openTime?: string;
      closeTime?: string;
    };
  };
}

@Injectable()
export class BusinessHoursService {
  private readonly logger = new Logger(BusinessHoursService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Check if business is currently within operating hours
   */
  async isWithinBusinessHours(businessId: string): Promise<boolean> {
    try {
      const businessHours = await this.getBusinessHours(businessId);
      
      if (!businessHours) {
        // Default to always open if no hours configured
        return true;
      }

      const now = new Date();
      const businessTime = this.convertToBusinessTimezone(now, businessHours.timezone);
      
      // Check if today is a holiday
      const todayStr = this.formatDate(businessTime);
      if (businessHours.holidays.includes(todayStr)) {
        return false;
      }

      // Check for special hours
      if (businessHours.specialHours[todayStr]) {
        const specialHour = businessHours.specialHours[todayStr];
        if (!specialHour.isOpen) {
          return false;
        }
        
        if (specialHour.openTime && specialHour.closeTime) {
          return this.isTimeWithinRange(
            businessTime,
            specialHour.openTime,
            specialHour.closeTime
          );
        }
      }

      // Check regular schedule
      const dayOfWeek = this.getDayOfWeek(businessTime);
      const daySchedule = businessHours.schedule[dayOfWeek];
      
      if (!daySchedule || !daySchedule.isOpen) {
        return false;
      }

      // Check if within main business hours
      const isWithinMainHours = this.isTimeWithinRange(
        businessTime,
        daySchedule.openTime,
        daySchedule.closeTime
      );

      if (!isWithinMainHours) {
        return false;
      }

      // Check if within break times (if any)
      if (daySchedule.breaks) {
        for (const breakTime of daySchedule.breaks) {
          if (this.isTimeWithinRange(businessTime, breakTime.startTime, breakTime.endTime)) {
            return false; // Currently in break time
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to check business hours: ${error.message}`, error.stack);
      return true; // Default to open on error
    }
  }

  /**
   * Get business hours configuration
   */
  async getBusinessHours(businessId: string): Promise<BusinessHours | null> {
    try {
      const key = `business:${businessId}:hours`;
      const data = await this.redis.get(key);
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get business hours: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Set business hours configuration
   */
  async setBusinessHours(businessHours: BusinessHours): Promise<void> {
    try {
      const key = `business:${businessHours.businessId}:hours`;
      await this.redis.set(key, JSON.stringify(businessHours));
      
      this.logger.log(`Updated business hours for ${businessHours.businessId}`);
    } catch (error) {
      this.logger.error(`Failed to set business hours: ${error.message}`, error.stack);
    }
  }

  /**
   * Get next opening time for a business
   */
  async getNextOpeningTime(businessId: string): Promise<Date | null> {
    try {
      const businessHours = await this.getBusinessHours(businessId);
      
      if (!businessHours) {
        return null;
      }

      const now = new Date();
      const businessTime = this.convertToBusinessTimezone(now, businessHours.timezone);
      
      // Check next 7 days
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(businessTime);
        checkDate.setDate(checkDate.getDate() + i);
        
        const dateStr = this.formatDate(checkDate);
        
        // Skip holidays
        if (businessHours.holidays.includes(dateStr)) {
          continue;
        }

        // Check special hours
        if (businessHours.specialHours[dateStr]) {
          const specialHour = businessHours.specialHours[dateStr];
          if (specialHour.isOpen && specialHour.openTime) {
            const openTime = this.parseTime(specialHour.openTime);
            checkDate.setHours(openTime.hours, openTime.minutes, 0, 0);
            
            if (checkDate > now) {
              return this.convertFromBusinessTimezone(checkDate, businessHours.timezone);
            }
          }
          continue;
        }

        // Check regular schedule
        const dayOfWeek = this.getDayOfWeek(checkDate);
        const daySchedule = businessHours.schedule[dayOfWeek];
        
        if (daySchedule && daySchedule.isOpen) {
          const openTime = this.parseTime(daySchedule.openTime);
          checkDate.setHours(openTime.hours, openTime.minutes, 0, 0);
          
          if (checkDate > now) {
            return this.convertFromBusinessTimezone(checkDate, businessHours.timezone);
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get next opening time: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get time until next opening
   */
  async getTimeUntilOpen(businessId: string): Promise<number | null> {
    try {
      const nextOpening = await this.getNextOpeningTime(businessId);
      
      if (!nextOpening) {
        return null;
      }

      const now = new Date();
      return Math.max(0, nextOpening.getTime() - now.getTime());
    } catch (error) {
      this.logger.error(`Failed to get time until open: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Check if business is open on a specific date
   */
  async isOpenOnDate(businessId: string, date: Date): Promise<boolean> {
    try {
      const businessHours = await this.getBusinessHours(businessId);
      
      if (!businessHours) {
        return true;
      }

      const businessDate = this.convertToBusinessTimezone(date, businessHours.timezone);
      const dateStr = this.formatDate(businessDate);
      
      // Check holidays
      if (businessHours.holidays.includes(dateStr)) {
        return false;
      }

      // Check special hours
      if (businessHours.specialHours[dateStr]) {
        return businessHours.specialHours[dateStr].isOpen;
      }

      // Check regular schedule
      const dayOfWeek = this.getDayOfWeek(businessDate);
      const daySchedule = businessHours.schedule[dayOfWeek];
      
      return daySchedule ? daySchedule.isOpen : false;
    } catch (error) {
      this.logger.error(`Failed to check if open on date: ${error.message}`, error.stack);
      return true;
    }
  }

  /**
   * Add holiday to business
   */
  async addHoliday(businessId: string, date: string): Promise<void> {
    try {
      const businessHours = await this.getBusinessHours(businessId);
      
      if (businessHours) {
        if (!businessHours.holidays.includes(date)) {
          businessHours.holidays.push(date);
          await this.setBusinessHours(businessHours);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to add holiday: ${error.message}`, error.stack);
    }
  }

  /**
   * Remove holiday from business
   */
  async removeHoliday(businessId: string, date: string): Promise<void> {
    try {
      const businessHours = await this.getBusinessHours(businessId);
      
      if (businessHours) {
        businessHours.holidays = businessHours.holidays.filter(h => h !== date);
        await this.setBusinessHours(businessHours);
      }
    } catch (error) {
      this.logger.error(`Failed to remove holiday: ${error.message}`, error.stack);
    }
  }

  /**
   * Convert time to business timezone
   */
  private convertToBusinessTimezone(date: Date, timezone: string): Date {
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
      this.logger.warn(`Invalid timezone ${timezone}, using UTC`);
      return date;
    }
  }

  /**
   * Convert time from business timezone to UTC
   */
  private convertFromBusinessTimezone(date: Date, timezone: string): Date {
    try {
      // This is a simplified conversion - in production, use a proper timezone library
      const utcTime = date.getTime() - (date.getTimezoneOffset() * 60000);
      return new Date(utcTime);
    } catch (error) {
      this.logger.warn(`Failed to convert from timezone ${timezone}`);
      return date;
    }
  }

  /**
   * Check if current time is within a time range
   */
  private isTimeWithinRange(date: Date, startTime: string, endTime: string): boolean {
    const currentTime = date.getHours() * 60 + date.getMinutes();
    
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    
    // Handle overnight hours (e.g., 22:00 - 06:00)
    if (endMinutes < startMinutes) {
      return currentTime >= startMinutes || currentTime <= endMinutes;
    }
    
    return currentTime >= startMinutes && currentTime <= endMinutes;
  }

  /**
   * Parse time string (HH:MM) to hours and minutes
   */
  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  /**
   * Get day of week as lowercase string
   */
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Create default business hours (9 AM - 5 PM, Monday to Friday)
   */
  createDefaultBusinessHours(businessId: string, timezone: string = 'UTC'): BusinessHours {
    return {
      businessId,
      timezone,
      schedule: {
        monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        saturday: { isOpen: false, openTime: '09:00', closeTime: '17:00' },
        sunday: { isOpen: false, openTime: '09:00', closeTime: '17:00' },
      },
      holidays: [],
      specialHours: {},
    };
  }
}