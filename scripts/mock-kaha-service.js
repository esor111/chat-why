const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

// Mock batch profiles endpoint
app.post('/api/batch/profiles', (req, res) => {
  console.log('📥 Mock kaha-main-v3 received request:', req.body);
  
  const { user_uuids = [], business_uuids = [] } = req.body;
  
  // Create mock user profiles
  const users = user_uuids.map(uuid => ({
    uuid: uuid,
    name: `User ${uuid.substring(0, 8)}`,
    email: `user-${uuid.substring(0, 8)}@example.com`,
    avatar: null,
    phone: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  // Create mock business profiles
  const businesses = business_uuids.map(uuid => ({
    uuid: uuid,
    name: `Business ${uuid.substring(0, 8)}`,
    description: `Mock business description for ${uuid.substring(0, 8)}`,
    logo: null,
    website: `https://business-${uuid.substring(0, 8)}.example.com`,
    phone: '+1234567890',
    email: `contact@business-${uuid.substring(0, 8)}.example.com`,
    address: '123 Mock Street, Mock City, MC 12345',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  const response = {
    users: users,
    businesses: businesses
  };
  
  console.log('📤 Mock kaha-main-v3 sending response:', response);
  res.json(response);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-kaha-main-v3' });
});

app.listen(port, () => {
  console.log(`🚀 Mock kaha-main-v3 service running on http://localhost:${port}`);
  console.log('📋 Available endpoints:');
  console.log('  POST /api/batch/profiles - Batch fetch user and business profiles');
  console.log('  GET /health - Health check');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down mock kaha-main-v3 service...');
  process.exit(0);
});