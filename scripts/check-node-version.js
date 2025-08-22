#!/usr/bin/env node

const semver = require('semver');

console.log('🔍 Checking Node.js version compatibility...\n');

const currentVersion = process.version;
const majorVersion = semver.major(currentVersion);

console.log(`Current Node.js version: ${currentVersion}`);

if (majorVersion === 20 || majorVersion === 18) {
  console.log('✅ Node.js version is compatible with NestJS v11');
} else if (majorVersion === 16) {
  console.log('⚠️  Node.js v16 is supported but v18 or v20 LTS is recommended');
} else if (majorVersion >= 21) {
  console.log('❌ Node.js v21+ may have compatibility issues with NestJS v11');
  console.log('💡 Recommendation: Use Node.js v20 LTS for best compatibility');
  console.log('');
  console.log('To switch to Node.js v20 LTS:');
  console.log('1. Using nvm: nvm install 20 && nvm use 20');
  console.log('2. Using volta: volta install node@20');
  console.log('3. Download from: https://nodejs.org/en/download/');
} else {
  console.log('❌ Node.js version is too old');
  console.log('💡 Please upgrade to Node.js v18 or v20 LTS');
}

console.log('\n📊 Compatibility Matrix:');
console.log('✅ Node.js v18 LTS - Fully supported');
console.log('✅ Node.js v20 LTS - Recommended');
console.log('⚠️  Node.js v16 - Supported but deprecated');
console.log('❌ Node.js v21+ - May have decorator issues');