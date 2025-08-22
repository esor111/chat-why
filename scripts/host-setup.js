#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Chat Backend Host System Setup\n');

async function testConnection(type, testFn) {
  try {
    await testFn();
    console.log(`✅ ${type} connection successful`);
    return true;
  } catch (error) {
    console.log(`❌ ${type} connection failed: ${error.message}`);
    return false;
  }
}

async function main() {
  // 1. Check .env file
  if (!fs.existsSync('.env')) {
    console.log('📝 Creating .env file from template...');
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ .env file created');
      console.log('⚠️  Please update .env with your database credentials\n');
    } else {
      console.log('❌ .env.example not found');
      return;
    }
  }

  // Load environment
  require('dotenv').config();

  // 2. Test PostgreSQL connection
  console.log('🔍 Testing PostgreSQL connection...');
  const pgSuccess = await testConnection('PostgreSQL', async () => {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'chat-meaw',
    });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  });

  if (!pgSuccess) {
    console.log('\n💡 PostgreSQL troubleshooting:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Create database: createdb chat-meaw');
    console.log('3. Check credentials in .env file');
    console.log('4. Test manually: psql -h localhost -U root -d chat-meaw\n');
  }

  // 3. Test Redis connection
  console.log('🔍 Testing Redis connection...');
  const redisSuccess = await testConnection('Redis', async () => {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });
    await redis.ping();
    redis.disconnect();
  });

  if (!redisSuccess) {
    console.log('\n💡 Redis troubleshooting:');
    console.log('1. Make sure Redis is running: redis-server');
    console.log('2. Test manually: redis-cli ping');
    console.log('3. Check Redis configuration in .env file\n');
  }

  if (!pgSuccess || !redisSuccess) {
    console.log('❌ Database connections failed. Please fix the issues above before continuing.');
    return;
  }

  // 4. Run migrations
  console.log('📊 Running database migrations...');
  try {
    execSync('npm run migration:run', { stdio: 'inherit' });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.log('⚠️  Migration warning (might be already up to date)');
  }

  // 5. Check for compilation errors
  console.log('\n🔨 Checking TypeScript compilation...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log('✅ TypeScript compilation successful');
  } catch (error) {
    console.log('❌ TypeScript compilation failed');
    console.log('Run: npm run check:errors for detailed error information');
    return;
  }

  // 6. Start the application
  console.log('\n🎯 Starting the application...');
  console.log('Press Ctrl+C to stop\n');
  
  const child = spawn('npm', ['run', 'start:dev'], { 
    stdio: 'inherit',
    shell: true 
  });

  child.on('error', (error) => {
    console.error('Failed to start application:', error);
  });

  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    child.kill('SIGINT');
    process.exit(0);
  });
}

main().catch(console.error);