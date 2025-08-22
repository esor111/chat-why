#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU';

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testAPI(method, endpoint, data = null) {
  try {
    console.log(`\n🧪 Testing ${method.toUpperCase()} ${endpoint}`);
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers,
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ Success: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ Failed: ${error.response?.status || 'Network Error'} ${error.response?.statusText || error.message}`);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  // Health check
  await testAPI('GET', '/health');
  
  // Auth endpoints
  await testAPI('GET', '/auth/me');
  await testAPI('GET', '/auth/health');
  
  // Conversations endpoints
  await testAPI('GET', '/conversations');
  
  // Try to create a direct conversation
  const directConv = await testAPI('POST', '/conversations/direct', {
    targetUserId: 'afc70db3-6f43-4882-92fd-4715f25ffc95' // Same user for testing
  });
  
  // Try to create a group conversation
  const groupConv = await testAPI('POST', '/conversations/group', {
    participantIds: ['afc70db3-6f43-4882-92fd-4715f25ffc95'],
    name: 'Test Group'
  });
  
  // Try to create a business conversation
  const businessConv = await testAPI('POST', '/conversations/business', {
    businessId: 'afc70db3-6f43-4882-92fd-4715f25ffc95'
  });
  
  // Messages endpoints (if we have a conversation)
  if (directConv?.id) {
    await testAPI('GET', `/conversations/${directConv.id}/messages`);
    
    // Send a test message
    const message = await testAPI('POST', `/conversations/${directConv.id}/messages`, {
      content: 'Hello, this is a test message!',
      type: 'text'
    });
    
    if (message?.id) {
      await testAPI('GET', `/messages/${message.id}`);
    }
  }
  
  // Notifications endpoints
  await testAPI('GET', '/notifications/unread-counts');
  
  // Business endpoints
  await testAPI('POST', '/business/conversations', {
    businessId: 'afc70db3-6f43-4882-92fd-4715f25ffc95',
    initialMessage: 'Hello from business chat!',
    priority: 'normal'
  });
  
  console.log('\n🏁 API Tests Completed!');
}

// Run the tests
runTests().catch(console.error);