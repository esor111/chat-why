#!/usr/bin/env node

const jwt = require('jsonwebtoken');

// Your JWT token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU';

// Default secret from .env
const secret = 'secret';

try {
  const decoded = jwt.verify(token, secret);
  console.log('✅ JWT Token is valid!');
  console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
  
  // Check if required fields exist
  if (decoded.id && decoded.kahaId) {
    console.log('✅ Token has required fields (id, kahaId)');
  } else {
    console.log('❌ Token missing required fields');
  }
  
} catch (error) {
  console.log('❌ JWT Token verification failed:', error.message);
  
  // Try to decode without verification to see the payload
  try {
    const decoded = jwt.decode(token);
    console.log('Token payload (unverified):', JSON.stringify(decoded, null, 2));
  } catch (decodeError) {
    console.log('❌ Cannot decode token:', decodeError.message);
  }
}