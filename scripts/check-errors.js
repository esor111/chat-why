#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 Checking for compilation errors...\n');

// Check TypeScript compilation
console.log('1. 🔨 TypeScript Compilation Check:');
try {
  execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout || error.stderr || error.message);
}

// Check if we can import the main module
console.log('\n2. 📦 Module Import Check:');
try {
  // Try to compile just the main file
  execSync('npx tsc src/main.ts --noEmit --skipLibCheck', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ Main module imports successful');
} catch (error) {
  console.log('❌ Main module import failed:');
  console.log(error.stdout || error.stderr || error.message);
}

// Check specific problematic files
console.log('\n3. 🎯 Specific File Checks:');
const filesToCheck = [
  'src/app.module.ts',
  'src/business/business.module.ts',
  'src/conversations/conversations.module.ts',
  'src/messages/messages.module.ts',
  'src/realtime/realtime.module.ts'
];

filesToCheck.forEach(file => {
  try {
    execSync(`npx tsc ${file} --noEmit --skipLibCheck`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${file}`);
  } catch (error) {
    console.log(`❌ ${file}:`);
    console.log(error.stdout || error.stderr || error.message);
  }
});

console.log('\n4. 🔗 Dependency Check:');
try {
  const packageJson = require('../package.json');
  const requiredDeps = ['@nestjs/core', '@nestjs/common', 'typeorm', 'pg', 'ioredis'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep}: NOT FOUND`);
    }
  });
} catch (error) {
  console.log('❌ Package.json check failed:', error.message);
}

console.log('\n🏁 Error check completed!');