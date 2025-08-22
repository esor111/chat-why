import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizationService {
  /**
   * Sanitizes message content by removing potentially harmful content
   * while preserving basic formatting
   */
  sanitizeMessageContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Trim whitespace
    let sanitized = content.trim();

    // Remove null bytes and control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Remove excessive whitespace (more than 2 consecutive spaces)
    sanitized = sanitized.replace(/\s{3,}/g, '  ');

    // Remove excessive newlines (more than 2 consecutive)
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Basic HTML/script tag removal for security
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    sanitized = sanitized.replace(/<embed\b[^<]*>/gi, '');

    // Remove javascript: and data: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    return sanitized;
  }

  /**
   * Sanitizes search queries to prevent injection attacks
   */
  sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Trim and normalize whitespace
    let sanitized = query.trim().replace(/\s+/g, ' ');

    // Remove special characters that could be used for injection
    sanitized = sanitized.replace(/[<>'";&|`$(){}[\]\\]/g, '');

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitizes group/conversation names
   */
  sanitizeConversationName(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    // Trim whitespace
    let sanitized = name.trim();

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s{2,}/g, ' ');

    // Basic HTML tag removal
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    return sanitized;
  }

  /**
   * Validates and sanitizes UUID strings
   */
  sanitizeUUID(uuid: string): string | null {
    if (!uuid || typeof uuid !== 'string') {
      return null;
    }

    // Remove any non-UUID characters
    const cleaned = uuid.replace(/[^a-fA-F0-9-]/g, '');
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    return uuidRegex.test(cleaned) ? cleaned.toLowerCase() : null;
  }
}