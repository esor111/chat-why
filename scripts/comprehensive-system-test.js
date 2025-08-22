#!/usr/bin/env node

/**
 * Comprehensive Chat System Test Suite
 * Tests all core functionality to validate 95%+ system completeness
 */

const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3000/chat';

// Test results tracking
const testResults = {
  authentication: false,
  directConversation: false,
  groupConversation: false,
  businessConversation: false,
  messaging: false,
  realTimeMessaging: false,
  typingIndicators: false,
  readReceipts: false,
  userPresence: false,
  profileEnrichment: false,
  unreadCounts: false,
  conversationManagement: false
};

let testUsers = [];
let testConversations = {};

async function setupTestUsers() {
  console.log('🔧 Setting up test users...');
  
  const users = [
    { kahaId: 'ishwor123', name: 'Ishwor' },
    { kahaId: 'bhuwan456', name: 'Bhuwan' },
    { kahaId: 'test123', name: 'Test User' }
  ];

  for (const user of users) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        kahaId: user.kahaId,
        password: 'password123'
      });
      
      testUsers.push({
        ...user,
        id: response.data.user.id,
        token: response.data.access_token
      });
      
      console.log(`✅ ${user.name} authenticated`);
    } catch (error) {
      console.error(`❌ Failed to authenticate ${user.name}:`, error.response?.data || error.message);
      throw new Error(`Authentication failed for ${user.name}`);
    }
  }
  
  testResults.authentication = true;
  console.log('✅ Authentication test PASSED\n');
}

async function testDirectConversations() {
  console.log('🧪 Testing Direct Conversations...');
  
  try {
    const response = await axios.post(`${BASE_URL}/conversations/direct`, {
      targetUserId: testUsers[1].id
    }, {
      headers: { Authorization: `Bearer ${testUsers[0].token}` }
    });
    
    testConversations.direct = response.data;
    console.log(`✅ Direct conversation created: ${response.data.id}`);
    
    // Verify conversation has 2 participants
    if (response.data.participants.length === 2) {
      console.log('✅ Direct conversation has correct participant count');
      testResults.directConversation = true;
    } else {
      console.log('❌ Direct conversation has incorrect participant count');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Direct conversation test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Direct conversation test PASSED\n');
  return true;
}

async function testGroupConversations() {
  console.log('🧪 Testing Group Conversations...');
  
  try {
    // Test 1: Try to create group with only 1 participant (should fail)
    try {
      await axios.post(`${BASE_URL}/conversations/group`, {
        participantIds: [testUsers[1].id],
        name: 'Invalid Group'
      }, {
        headers: { Authorization: `Bearer ${testUsers[0].token}` }
      });
      
      console.log('❌ Group validation failed - allowed 2 participants');
      return false;
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Group validation works - rejected 2 participants');
      } else {
        console.log('❌ Unexpected error in group validation');
        return false;
      }
    }
    
    // Test 2: Create valid group with 3 participants
    const response = await axios.post(`${BASE_URL}/conversations/group`, {
      participantIds: [testUsers[1].id, testUsers[2].id],
      name: 'Test Group Chat'
    }, {
      headers: { Authorization: `Bearer ${testUsers[0].token}` }
    });
    
    testConversations.group = response.data;
    console.log(`✅ Group conversation created: ${response.data.id}`);
    
    // Verify conversation has 3 participants
    if (response.data.participants.length === 3) {
      console.log('✅ Group conversation has correct participant count');
      testResults.groupConversation = true;
    } else {
      console.log('❌ Group conversation has incorrect participant count');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Group conversation test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Group conversation test PASSED\n');
  return true;
}

async function testBusinessConversations() {
  console.log('🧪 Testing Business Conversations...');
  
  try {
    const response = await axios.post(`${BASE_URL}/conversations/business`, {
      businessId: 'test-business-uuid',
      agentId: testUsers[2].id
    }, {
      headers: { Authorization: `Bearer ${testUsers[0].token}` }
    });
    
    testConversations.business = response.data;
    console.log(`✅ Business conversation created: ${response.data.id}`);
    
    // Verify conversation structure
    if (response.data.type === 'business' && response.data.businessId) {
      console.log('✅ Business conversation has correct structure');
      testResults.businessConversation = true;
    } else {
      console.log('❌ Business conversation has incorrect structure');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Business conversation test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Business conversation test PASSED\n');
  return true;
}

async function testMessaging() {
  console.log('🧪 Testing Messaging System...');
  
  try {
    // Send message to direct conversation
    const messageResponse = await axios.post(
      `${BASE_URL}/conversations/${testConversations.direct.id}/messages`,
      {
        content: 'Hello from direct chat!',
        type: 'text'
      },
      {
        headers: { Authorization: `Bearer ${testUsers[0].token}` }
      }
    );
    
    console.log(`✅ Message sent: ${messageResponse.data.id}`);
    
    // Verify message has profile enrichment
    if (messageResponse.data.sender && messageResponse.data.sender.name) {
      console.log('✅ Message includes profile enrichment');
      testResults.profileEnrichment = true;
    } else {
      console.log('❌ Message missing profile enrichment');
    }
    
    // Get messages from conversation
    const messagesResponse = await axios.get(
      `${BASE_URL}/conversations/${testConversations.direct.id}/messages`,
      {
        headers: { Authorization: `Bearer ${testUsers[1].token}` }
      }
    );
    
    if (messagesResponse.data.messages.length > 0) {
      console.log('✅ Messages retrieved successfully');
      testResults.messaging = true;
    } else {
      console.log('❌ No messages retrieved');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Messaging test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Messaging test PASSED\n');
  return true;
}

async function testRealTimeFeatures() {
  console.log('🧪 Testing Real-time Features...');
  
  return new Promise(async (resolve) => {
    try {
      // Create WebSocket connections
      const socket1 = io(WS_URL, {
        auth: { token: testUsers[0].token },
        transports: ['websocket']
      });
      
      const socket2 = io(WS_URL, {
        auth: { token: testUsers[1].token },
        transports: ['websocket']
      });
      
      let connectionsReady = 0;
      let testsCompleted = 0;
      const totalTests = 4; // messaging, typing, read receipts, presence
      
      const checkComplete = () => {
        if (testsCompleted >= totalTests) {
          socket1.disconnect();
          socket2.disconnect();
          console.log('✅ Real-time features test PASSED\n');
          resolve(true);
        }
      };
      
      // Wait for connections
      socket1.on('connect', () => {
        connectionsReady++;
        if (connectionsReady === 2) {
          startRealTimeTests();
        }
      });
      
      socket2.on('connect', () => {
        connectionsReady++;
        if (connectionsReady === 2) {
          startRealTimeTests();
        }
      });
      
      const startRealTimeTests = () => {
        // Join conversation
        socket1.emit('join_conversation', { conversationId: testConversations.direct.id });
        socket2.emit('join_conversation', { conversationId: testConversations.direct.id });
        
        // Test 1: Real-time messaging
        socket2.on('new_message', (data) => {
          if (data.content === 'Real-time test message') {
            console.log('✅ Real-time messaging works');
            testResults.realTimeMessaging = true;
            testsCompleted++;
            checkComplete();
          }
        });
        
        // Test 2: Typing indicators
        socket2.on('user_typing', (data) => {
          console.log('✅ Typing indicators work');
          testResults.typingIndicators = true;
          testsCompleted++;
          checkComplete();
        });
        
        // Test 3: Read receipts
        socket1.on('message_read', (data) => {
          console.log('✅ Read receipts work');
          testResults.readReceipts = true;
          testsCompleted++;
          checkComplete();
        });
        
        // Test 4: Presence system
        socket1.on('heartbeat_ack', (data) => {
          console.log('✅ Presence system works');
          testResults.userPresence = true;
          testsCompleted++;
          checkComplete();
        });
        
        // Trigger tests
        setTimeout(() => {
          // Send real-time message
          axios.post(
            `${BASE_URL}/conversations/${testConversations.direct.id}/messages`,
            { content: 'Real-time test message', type: 'text' },
            { headers: { Authorization: `Bearer ${testUsers[0].token}` } }
          );
          
          // Trigger typing
          socket1.emit('start_typing', { conversationId: testConversations.direct.id });
          
          // Trigger read receipt
          socket2.emit('mark_as_read', { 
            conversationId: testConversations.direct.id, 
            messageId: 'test-message-id' 
          });
          
          // Trigger heartbeat
          socket1.emit('heartbeat');
        }, 1000);
      };
      
      // Timeout fallback
      setTimeout(() => {
        if (testsCompleted < totalTests) {
          console.log(`❌ Real-time tests incomplete: ${testsCompleted}/${totalTests}`);
          socket1.disconnect();
          socket2.disconnect();
          resolve(false);
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ Real-time features test failed:', error.message);
      resolve(false);
    }
  });
}

async function testUnreadCounts() {
  console.log('🧪 Testing Unread Counts...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/conversations/${testConversations.direct.id}/unread-count`,
      {
        headers: { Authorization: `Bearer ${testUsers[1].token}` }
      }
    );
    
    if (typeof response.data.unreadCount === 'number') {
      console.log(`✅ Unread count retrieved: ${response.data.unreadCount}`);
      testResults.unreadCounts = true;
    } else {
      console.log('❌ Invalid unread count format');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Unread counts test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Unread counts test PASSED\n');
  return true;
}

async function testConversationManagement() {
  console.log('🧪 Testing Conversation Management...');
  
  try {
    // Get user conversations
    const conversationsResponse = await axios.get(`${BASE_URL}/conversations`, {
      headers: { Authorization: `Bearer ${testUsers[0].token}` }
    });
    
    if (conversationsResponse.data.conversations.length >= 2) {
      console.log(`✅ User conversations retrieved: ${conversationsResponse.data.conversations.length}`);
    } else {
      console.log('❌ Insufficient conversations retrieved');
      return false;
    }
    
    // Mark conversation as read
    await axios.put(
      `${BASE_URL}/conversations/${testConversations.direct.id}/read`,
      {},
      {
        headers: { Authorization: `Bearer ${testUsers[1].token}` }
      }
    );
    
    console.log('✅ Conversation marked as read');
    
    // Toggle mute
    await axios.put(
      `${BASE_URL}/conversations/${testConversations.direct.id}/mute`,
      { isMuted: true },
      {
        headers: { Authorization: `Bearer ${testUsers[1].token}` }
      }
    );
    
    console.log('✅ Conversation muted successfully');
    testResults.conversationManagement = true;
    
  } catch (error) {
    console.error('❌ Conversation management test failed:', error.response?.data || error.message);
    return false;
  }
  
  console.log('✅ Conversation management test PASSED\n');
  return true;
}

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Chat System Test Suite...\n');
  
  try {
    await setupTestUsers();
    await testDirectConversations();
    await testGroupConversations();
    await testBusinessConversations();
    await testMessaging();
    await testRealTimeFeatures();
    await testUnreadCounts();
    await testConversationManagement();
    
    // Calculate results
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(result => result).length;
    const successRate = (passedTests / totalTests * 100).toFixed(1);
    
    console.log('📊 COMPREHENSIVE TEST RESULTS:');
    console.log('================================');
    
    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    });
    
    console.log(`\n🎯 SUCCESS RATE: ${successRate}% (${passedTests}/${totalTests})`);
    
    if (successRate >= 95) {
      console.log('🎉 SYSTEM COMPLETENESS: 95%+ ACHIEVED!');
      console.log('🚀 Chat system is production-ready for core functionality!');
    } else if (successRate >= 85) {
      console.log('⚠️  SYSTEM COMPLETENESS: Good but needs minor fixes');
    } else {
      console.log('❌ SYSTEM COMPLETENESS: Major issues need addressing');
    }
    
    process.exit(successRate >= 95 ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Test suite interrupted');
  process.exit(1);
});

// Run the comprehensive tests
runComprehensiveTests();