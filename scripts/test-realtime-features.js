#!/usr/bin/env node

/**
 * Real-time Features Test Script
 * Tests typing indicators, read receipts, and presence system
 */

const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3000/chat';

// Test users (should exist in database)
const TEST_USERS = [
  {
    id: 'ishwor-uuid',
    kahaId: 'ishwor123',
    token: null // Will be set after login
  },
  {
    id: 'bhuwan-uuid', 
    kahaId: 'bhuwan456',
    token: null // Will be set after login
  }
];

let conversationId = null;

async function loginUser(kahaId) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      kahaId,
      password: 'password123'
    });
    
    console.log(`✅ User ${kahaId} logged in successfully`);
    return response.data.access_token;
  } catch (error) {
    console.error(`❌ Failed to login user ${kahaId}:`, error.response?.data || error.message);
    return null;
  }
}

async function createConversation(token, participantKahaIds) {
  try {
    const response = await axios.post(`${BASE_URL}/conversations`, {
      type: 'direct',
      participantKahaIds
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`✅ Conversation created: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('❌ Failed to create conversation:', error.response?.data || error.message);
    return null;
  }
}

function createWebSocketConnection(token, userId) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log(`✅ WebSocket connected for user ${userId}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ WebSocket connection failed for user ${userId}:`, error.message);
      reject(error);
    });

    socket.on('connected', (data) => {
      console.log(`✅ WebSocket authenticated for user ${userId}:`, data);
    });

    // Listen for real-time events
    socket.on('new_message', (data) => {
      console.log(`📨 New message received by ${userId}:`, {
        content: data.content,
        sender: data.sender?.name || data.senderId,
        timestamp: data.timestamp
      });
    });

    socket.on('user_typing', (data) => {
      console.log(`⌨️  User typing event received by ${userId}:`, {
        typingUserId: data.userId,
        conversationId: data.conversationId
      });
    });

    socket.on('user_stopped_typing', (data) => {
      console.log(`⏹️  User stopped typing event received by ${userId}:`, {
        userId: data.userId,
        conversationId: data.conversationId
      });
    });

    socket.on('message_read', (data) => {
      console.log(`👁️  Message read event received by ${userId}:`, {
        readByUserId: data.userId,
        messageId: data.messageId
      });
    });

    socket.on('presence_update', (data) => {
      console.log(`🟢 Presence update received by ${userId}:`, data);
    });

    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

async function testTypingIndicators(socket1, socket2, conversationId) {
  console.log('\n🧪 Testing Typing Indicators...');
  
  return new Promise((resolve) => {
    let typingReceived = false;
    let stoppedTypingReceived = false;

    // Listen for typing events on socket2
    socket2.on('user_typing', () => {
      typingReceived = true;
      console.log('✅ Typing indicator received');
    });

    socket2.on('user_stopped_typing', () => {
      stoppedTypingReceived = true;
      console.log('✅ Stop typing indicator received');
      
      if (typingReceived && stoppedTypingReceived) {
        console.log('✅ Typing indicators test PASSED');
        resolve(true);
      }
    });

    // Join conversation and start typing
    socket1.emit('join_conversation', { conversationId });
    socket2.emit('join_conversation', { conversationId });

    setTimeout(() => {
      socket1.emit('start_typing', { conversationId });
    }, 500);

    setTimeout(() => {
      socket1.emit('stop_typing', { conversationId });
    }, 2000);

    setTimeout(() => {
      if (!typingReceived || !stoppedTypingReceived) {
        console.log('❌ Typing indicators test FAILED');
        resolve(false);
      }
    }, 4000);
  });
}

async function testMessageBroadcasting(token, socket2, conversationId) {
  console.log('\n🧪 Testing Message Broadcasting...');
  
  return new Promise(async (resolve) => {
    let messageReceived = false;

    // Listen for new message on socket2
    socket2.on('new_message', (data) => {
      if (data.content === 'Test real-time message') {
        messageReceived = true;
        console.log('✅ Real-time message received with profile data:', {
          content: data.content,
          senderName: data.sender?.name,
          senderKahaId: data.sender?.kahaId
        });
        console.log('✅ Message broadcasting test PASSED');
        resolve(true);
      }
    });

    // Send message via API
    try {
      await axios.post(`${BASE_URL}/conversations/${conversationId}/messages`, {
        content: 'Test real-time message',
        type: 'text'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Message sent via API');
    } catch (error) {
      console.error('❌ Failed to send message:', error.response?.data || error.message);
      resolve(false);
    }

    setTimeout(() => {
      if (!messageReceived) {
        console.log('❌ Message broadcasting test FAILED');
        resolve(false);
      }
    }, 3000);
  });
}

async function testReadReceipts(socket1, socket2, conversationId) {
  console.log('\n🧪 Testing Read Receipts...');
  
  return new Promise((resolve) => {
    let readReceiptReceived = false;

    // Listen for read receipt on socket1
    socket1.on('message_read', (data) => {
      readReceiptReceived = true;
      console.log('✅ Read receipt received:', {
        messageId: data.messageId,
        readByUserId: data.userId
      });
      console.log('✅ Read receipts test PASSED');
      resolve(true);
    });

    // Simulate marking message as read
    setTimeout(() => {
      socket2.emit('mark_as_read', { 
        conversationId, 
        messageId: 'dummy-message-id' // In real test, use actual message ID
      });
    }, 500);

    setTimeout(() => {
      if (!readReceiptReceived) {
        console.log('❌ Read receipts test FAILED');
        resolve(false);
      }
    }, 3000);
  });
}

async function testPresenceSystem(socket1, socket2) {
  console.log('\n🧪 Testing Presence System...');
  
  return new Promise((resolve) => {
    let presenceReceived = false;

    // Listen for presence updates
    socket2.on('presence_update', (data) => {
      if (data.presences || data.status) {
        presenceReceived = true;
        console.log('✅ Presence update received:', data);
        console.log('✅ Presence system test PASSED');
        resolve(true);
      }
    });

    // Request presence info
    setTimeout(() => {
      socket1.emit('get_presence', { 
        userIds: [TEST_USERS[0].id, TEST_USERS[1].id] 
      });
    }, 500);

    // Send heartbeat
    setTimeout(() => {
      socket1.emit('heartbeat');
    }, 1000);

    setTimeout(() => {
      if (!presenceReceived) {
        console.log('❌ Presence system test FAILED');
        resolve(false);
      }
    }, 3000);
  });
}

async function runTests() {
  console.log('🚀 Starting Real-time Features Test Suite...\n');

  try {
    // Step 1: Login users
    console.log('📝 Step 1: Logging in test users...');
    for (const user of TEST_USERS) {
      user.token = await loginUser(user.kahaId);
      if (!user.token) {
        throw new Error(`Failed to login user ${user.kahaId}`);
      }
    }

    // Step 2: Create conversation
    console.log('\n📝 Step 2: Creating test conversation...');
    conversationId = await createConversation(
      TEST_USERS[0].token, 
      [TEST_USERS[0].kahaId, TEST_USERS[1].kahaId]
    );
    if (!conversationId) {
      throw new Error('Failed to create conversation');
    }

    // Step 3: Establish WebSocket connections
    console.log('\n📝 Step 3: Establishing WebSocket connections...');
    const socket1 = await createWebSocketConnection(TEST_USERS[0].token, TEST_USERS[0].id);
    const socket2 = await createWebSocketConnection(TEST_USERS[1].token, TEST_USERS[1].id);

    // Step 4: Run tests
    console.log('\n📝 Step 4: Running real-time feature tests...');
    
    const typingTest = await testTypingIndicators(socket1, socket2, conversationId);
    const messagingTest = await testMessageBroadcasting(TEST_USERS[0].token, socket2, conversationId);
    const readReceiptTest = await testReadReceipts(socket1, socket2, conversationId);
    const presenceTest = await testPresenceSystem(socket1, socket2);

    // Step 5: Results
    console.log('\n📊 TEST RESULTS:');
    console.log(`Typing Indicators: ${typingTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message Broadcasting: ${messagingTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Read Receipts: ${readReceiptTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Presence System: ${presenceTest ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = typingTest && messagingTest && readReceiptTest && presenceTest;
    console.log(`\n🎯 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    // Cleanup
    socket1.disconnect();
    socket2.disconnect();

    process.exit(allPassed ? 0 : 1);

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

// Run the tests
runTests();