#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting Chat Backend...');

  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found, creating from .env.example...');
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('✅ Created .env file from .env.example');
      console.log('⚠️  Please update the .env file with your database credentials');
    } else {
      console.error('❌ .env.example file not found');
      process.exit(1);
    }
  }

  async function testConnections() {
    // Test database connection
    console.log('🔍 Testing PostgreSQL connection...');
    try {
      const { Client } = require('pg');
      require('dotenv').config();

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
      console.log('✅ PostgreSQL connection successful');
    } catch (dbError) {
      console.error('❌ PostgreSQL connection failed:', dbError.message);
      console.log('💡 Make sure PostgreSQL is running and credentials are correct in .env');
      process.exit(1);
    }

    // Test Redis connection
    console.log('🔍 Testing Redis connection...');
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      });

      await redis.ping();
      redis.disconnect();
      console.log('✅ Redis connection successful');
    } catch (redisError) {
      console.error('❌ Redis connection failed:', redisError.message);
      console.log('💡 Make sure Redis is running on your host system');
      process.exit(1);
    }
  }

  try {
    await testConnections();

    // Run migrations
    console.log('📊 Running database migrations...');
    try {
      execSync('npm run migration:run', { stdio: 'inherit' });
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.log('⚠️  Migration failed, but continuing (database might already be up to date)');
    }

    // Start the application
    console.log('🎯 Starting the application...');
    execSync('npm run start:dev', { stdio: 'inherit' });

  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Failed to start application:', error.message);
  process.exit(1);
});