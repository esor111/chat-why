const https = require('http');

const endpoints = [
  // Basic endpoints (should work without auth)
  { method: 'GET', path: '/', expectStatus: 200, description: 'Root endpoint' },
  { method: 'GET', path: '/health', expectStatus: 200, description: 'Health check' },
  { method: 'GET', path: '/auth/health', expectStatus: 200, description: 'Auth health check' },
  
  // Protected endpoints (should return 401)
  { method: 'GET', path: '/auth/me', expectStatus: 401, description: 'Get current user' },
  { method: 'GET', path: '/conversations', expectStatus: 401, description: 'Get conversations' },
  { method: 'POST', path: '/conversations/direct', expectStatus: 401, description: 'Create direct conversation', body: '{"participantId": "test"}' },
  { method: 'POST', path: '/conversations/group', expectStatus: 401, description: 'Create group conversation', body: '{"name": "test", "participantIds": []}' },
  { method: 'POST', path: '/conversations/business', expectStatus: 401, description: 'Create business conversation', body: '{"customerId": "test", "businessId": "test"}' },
  { method: 'GET', path: '/notifications/unread-counts', expectStatus: 401, description: 'Get unread counts' },
  { method: 'POST', path: '/business/conversations', expectStatus: 401, description: 'Create business conversation', body: '{"customerId": "test", "businessId": "test"}' },
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode === endpoint.expectStatus;
        resolve({
          ...endpoint,
          actualStatus: res.statusCode,
          success,
          response: data
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        ...endpoint,
        actualStatus: 'ERROR',
        success: false,
        error: error.message
      });
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Chat Backend Endpoints...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
    console.log(`   Expected: ${endpoint.expectStatus}, Got: ${result.actualStatus}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error || 'Status code mismatch'}`);
    }
    console.log('');
  }
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n📊 Test Summary: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All endpoints are working correctly!');
  } else {
    console.log('⚠️  Some endpoints need attention.');
  }
}

runTests().catch(console.error);