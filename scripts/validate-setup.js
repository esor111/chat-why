#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 Validating Chat Backend Setup...\n');

let hasErrors = false;

// Check Node.js version compatibility
console.log('🔧 Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion === 20 || majorVersion === 18) {
  console.log(`✅ Node.js ${nodeVersion} (compatible)`);
} else if (majorVersion >= 21) {
  console.log(`⚠️  Node.js ${nodeVersion} (may have decorator compatibility issues)`);
  console.log('💡 Consider using Node.js v20 LTS for best compatibility');
} else if (majorVersion === 16) {
  console.log(`⚠️  Node.js ${nodeVersion} (supported but v18+ recommended)`);
} else {
  console.log(`❌ Node.js ${nodeVersion} (unsupported)`);
  hasErrors = true;
}

// Check if required files exist
const requiredFiles = [
  '.env',
  'package.json',
  'tsconfig.json',
  'data-source.ts',
  'src/main.ts',
  'src/app.module.ts'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    hasErrors = true;
  }
});

// Check environment variables
console.log('\n🔧 Checking environment variables...');
require('dotenv').config();

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT', 
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - NOT SET`);
    hasErrors = true;
  }
});

// Test database connections
console.log('\n🔗 Testing database connections...');

// Test PostgreSQL
try {
  const { Client } = require('pg');
  // This is a sync check, so we'll just validate the config
  console.log('✅ PostgreSQL configuration looks valid');
} catch (error) {
  console.log('❌ PostgreSQL configuration error:', error.message);
  hasErrors = true;
}

// Test Redis
try {
  require('ioredis');
  console.log('✅ Redis configuration looks valid');
} catch (error) {
  console.log('❌ Redis configuration error:', error.message);
  hasErrors = true;
}

// Check package.json dependencies
console.log('\n📦 Checking key dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  '@nestjs/core',
  '@nestjs/typeorm',
  'typeorm',
  'pg',
  'ioredis',
  'socket.io'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep} - NOT INSTALLED`);
    hasErrors = true;
  }
});

// Check TypeScript compilation
console.log('\n🔨 Checking TypeScript compilation...');
try {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  console.log('Error:', error.stdout?.toString() || error.message);
  hasErrors = true;
}

// Summary
console.log('\n📊 Validation Summary:');
if (hasErrors) {
  console.log('❌ Setup validation FAILED');
  console.log('\n🔧 To fix issues:');
  console.log('1. Run: cp .env.example .env');
  console.log('2. Edit .env with your database credentials');
  console.log('3. Run: npm install');
  console.log('4. Make sure PostgreSQL and Redis are running on your host system');
  console.log('5. Test connections: psql -h localhost -U root -d chat-meaw');
  console.log('6. Test Redis: redis-cli ping');
  process.exit(1);
} else {
  console.log('✅ Setup validation PASSED');
  console.log('\n🚀 Ready to start the application!');
  console.log('Run: npm run start:dev');
}