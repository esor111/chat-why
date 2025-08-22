const { validate: uuidValidate, version: uuidVersion } = require('uuid');

const testUuids = [
  'afc70db3-6f43-4882-92fd-4715f25ffc95',
  '12345678-1234-1234-1234-123456789012',
  '12345678-1234-4234-8234-123456789012', // Valid v4 format
];

testUuids.forEach(uuid => {
  const isValid = uuidValidate(uuid);
  const version = isValid ? uuidVersion(uuid) : 'invalid';
  console.log(`UUID: ${uuid}`);
  console.log(`  Valid: ${isValid}`);
  console.log(`  Version: ${version}`);
  console.log(`  Is v4: ${version === 4}`);
  console.log('');
});