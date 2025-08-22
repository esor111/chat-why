const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU';

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function testEndpoint(method, endpoint, data = null, expectedStatus = 200) {
  try {
    console.log(`\n🧪 Testing ${method.toUpperCase()} ${endpoint}`);
    
    const config = {
      method: method.toLowerCase(),
      url: `${BASE_URL}${endpoint}`,
      headers: headers
    };
    
    if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      console.log(`✅ SUCCESS: ${response.status} - ${JSON.stringify(response.data).substring(0, 100)}...`);
      testResults.passed++;
      return response.data;
    } else {
      console.log(`⚠️  UNEXPECTED STATUS: Expected ${expectedStatus}, got ${response.status}`);
      testResults.failed++;
      testResults.errors.push(`${method} ${endpoint}: Expected ${expectedStatus}, got ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.response?.status || 'Network'} - ${error.response?.data?.message || error.message}`);
    testResults.failed++;
    testResults.errors.push(`${method} ${endpoint}: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive API testing...\n');
  console.log(`Using JWT Token: ${JWT_TOKEN.substring(0, 50)}...`);
  
  // Basic endpoints
  console.log('\n📋 === BASIC ENDPOINTS ===');
  await testEndpoint('GET', '/');
  await testEndpoint('GET', '/health');
  
  // Auth endpoints
  console.log('\n🔐 === AUTH ENDPOINTS ===');
  const userProfile = await testEndpoint('GET', '/auth/me');
  await testEndpoint('GET', '/auth/health');
  
  // Conversations endpoints
  console.log('\n💬 === CONVERSATION ENDPOINTS ===');
  await testEndpoint('GET', '/conversations');
  
  // Test creating different types of conversations
  const directConvData = {
    targetUserId: '12345678-1234-4234-8234-123456789012' // Different user ID
  };
  const directConv = await testEndpoint('POST', '/conversations/direct', directConvData, 201);
  
  const groupConvData = {
    name: 'Test Group',
    participantIds: ['12345678-1234-4234-8234-123456789012'] // Creator + 1 participant = 2 total (might need 3+)
  };
  const groupConv = await testEndpoint('POST', '/conversations/group', groupConvData, 201);
  
  const businessConvData = {
    businessId: 'afc70db3-6f43-4882-92fd-4715f25ffc95' // Just businessId as per DTO
  };
  const businessConv = await testEndpoint('POST', '/conversations/business', businessConvData, 201);
  
  // If we have a conversation ID, test conversation-specific endpoints
  let conversationId = null;
  if (directConv && directConv.id) {
    conversationId = directConv.id;
  } else if (groupConv && groupConv.id) {
    conversationId = groupConv.id;
  } else if (businessConv && businessConv.id) {
    conversationId = businessConv.id;
  }
  
  if (conversationId) {
    console.log(`\n📝 Testing with conversation ID: ${conversationId}`);
    await testEndpoint('GET', `/conversations/${conversationId}`);
    await testEndpoint('GET', `/conversations/${conversationId}/unread-count`);
    await testEndpoint('PUT', `/conversations/${conversationId}/read`);
    await testEndpoint('PUT', `/conversations/${conversationId}/mute`, { muted: true });
    
    // Test adding participants
    const participantData = {
      userId: 'af70db3-6f43-4882-92fd-4715f25ffc95',
      role: 'member'
    };
    await testEndpoint('POST', `/conversations/${conversationId}/participants`, participantData);
    
    // Messages endpoints
    console.log('\n📨 === MESSAGE ENDPOINTS ===');
    const messageData = {
      content: 'Test message from API testing',
      type: 'text'
    };
    const message = await testEndpoint('POST', `/conversations/${conversationId}/messages`, messageData);
    
    await testEndpoint('GET', `/conversations/${conversationId}/messages`);
    await testEndpoint('GET', `/conversations/${conversationId}/messages/search?q=test`);
    await testEndpoint('GET', `/conversations/${conversationId}/messages/count`);
    
    if (message && message.id) {
      await testEndpoint('GET', `/conversations/${conversationId}/messages/${message.id}`);
      await testEndpoint('DELETE', `/conversations/${conversationId}/messages/${message.id}`);
    }
  }
  
  // Business endpoints
  console.log('\n🏢 === BUSINESS ENDPOINTS ===');
  const businessId = 'afc70db3-6f43-4882-92fd-4715f25ffc95'; // Using valid UUID
  
  await testEndpoint('GET', `/business/${businessId}/stats`);
  await testEndpoint('GET', `/business/${businessId}/agents`);
  await testEndpoint('GET', `/business/${businessId}/agents/stats`);
  await testEndpoint('GET', `/business/${businessId}/hours`);
  await testEndpoint('GET', `/business/${businessId}/hours/status`);
  
  // Test business hours update
  const businessHoursData = {
    timezone: 'America/New_York',
    schedule: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      saturday: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
      sunday: { isOpen: false, openTime: '10:00', closeTime: '16:00' }
    },
    holidays: ['2025-12-25', '2025-01-01']
  };
  await testEndpoint('PUT', `/business/${businessId}/hours`, businessHoursData);
  
  // Test agent management
  const agentId = 'afc70db3-6f43-4882-92fd-4715f25ffc95'; // Using valid UUID
  const agentData = {
    businessId: businessId,
    agentId: agentId
  };
  await testEndpoint('POST', `/business/${businessId}/agents/${agentId}`, agentData, 201);
  
  const agentConfigData = {
    maxConcurrentChats: 5,
    skills: ['support', 'sales'],
    averageResponseTime: 60
  };
  await testEndpoint('PUT', `/business/agents/${agentId}/configure`, agentConfigData);
  
  const availabilityData = {
    available: true
  };
  await testEndpoint('PUT', `/business/agents/${agentId}/availability`, availabilityData);
  
  // Notifications endpoints
  console.log('\n🔔 === NOTIFICATION ENDPOINTS ===');
  await testEndpoint('GET', '/notifications/unread-counts');
  await testEndpoint('PUT', '/notifications/mark-all-read');
  
  if (conversationId) {
    await testEndpoint('GET', `/notifications/conversations/${conversationId}/unread-count`);
    await testEndpoint('PUT', `/notifications/conversations/${conversationId}/mark-read`);
    await testEndpoint('GET', `/notifications/conversations/${conversationId}/read-receipts`);
    await testEndpoint('GET', `/notifications/conversations/${conversationId}/last-read`);
    await testEndpoint('PUT', `/notifications/conversations/${conversationId}/mute`, { muted: false });
  }
  
  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  console.log('\n🎉 API testing completed!');
}

// Run the tests
runAllTests().catch(console.error);