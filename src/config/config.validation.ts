import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_SSL: Joi.string().valid('true', 'false').default('false'),
  
  // Redis configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  
  // JWT configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  
  // External service configuration
  KAHA_MAIN_V3_URL: Joi.string().uri().required(),
  KAHA_MAIN_V3_SERVICE_TOKEN: Joi.string().required(),
  
  // Cache configuration
  PROFILE_CACHE_TTL: Joi.number().default(86400), // 24 hours
  
  // Real-time configuration
  PRESENCE_HEARTBEAT_TIMEOUT: Joi.number().default(30), // 30 seconds
  PRESENCE_AWAY_TIMEOUT: Joi.number().default(300), // 5 minutes
  TYPING_TIMEOUT: Joi.number().default(5), // 5 seconds
  MESSAGE_MAX_DELIVERY_ATTEMPTS: Joi.number().default(3),
  MESSAGE_QUEUE_RETENTION_HOURS: Joi.number().default(72), // 72 hours
  
  // CORS configuration
  CORS_ORIGIN: Joi.string().default('*'),
});