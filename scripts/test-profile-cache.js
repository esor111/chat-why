const Redis = require('ioredis');
require('dotenv').config();

async function testProfileCache() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  });

  try {
    console.log('🔍 Checking profile cache...');
    
    // Check for user profile cache
    const userKey = 'profile:user:afc70db3-6f43-4882-92fd-4715f25ffc95';
    const userProfile = await redis.get(userKey);
    console.log('User profile cache:', userProfile ? 'EXISTS' : 'NOT FOUND');
    
    // Check for business profile cache
    const businessKey = 'profile:business:afc70db3-6f43-4882-92fd-4715f25ffc95';
    const businessProfile = await redis.get(businessKey);
    console.log('Business profile cache:', businessProfile ? 'EXISTS' : 'NOT FOUND');
    
    // List all profile-related keys
    const keys = await redis.keys('profile:*');
    console.log('All profile cache keys:', keys);
    
    // Create mock profile data in cache for testing
    const mockUserProfile = {
      uuid: 'afc70db3-6f43-4882-92fd-4715f25ffc95',
      name: 'Test User',
      email: 'test@example.com',
      avatar: null
    };
    
    const mockUserProfile2 = {
      uuid: '12345678-1234-1234-1234-123456789012',
      name: 'Test User 2',
      email: 'test2@example.com',
      avatar: null
    };
    
    await redis.setex(
      'profile:user:afc70db3-6f43-4882-92fd-4715f25ffc95',
      86400, // 24 hours
      JSON.stringify(mockUserProfile)
    );
    
    await redis.setex(
      'profile:user:12345678-1234-1234-1234-123456789012',
      86400, // 24 hours
      JSON.stringify(mockUserProfile2)
    );
    
    console.log('✅ Mock user profiles cached for testing');
    
  } catch (error) {
    console.error('❌ Cache error:', error.message);
  } finally {
    redis.disconnect();
  }
}

testProfileCache();