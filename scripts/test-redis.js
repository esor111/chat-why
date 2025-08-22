const Redis = require('ioredis');
require('dotenv').config();

async function testRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  });

  try {
    console.log('🔗 Testing Redis connection...');
    const result = await redis.ping();
    console.log('✅ Redis PING result:', result);
    
    // Test set/get
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('✅ Redis set/get test:', value);
    
    await redis.del('test-key');
    console.log('✅ Redis connection working properly');
    
  } catch (error) {
    console.error('❌ Redis error:', error.message);
  } finally {
    redis.disconnect();
  }
}

testRedis();