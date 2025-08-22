#!/usr/bin/env node

/**
 * Group Chat Validation Test
 * Tests that group chats require 3+ participants
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

async function testGroupChatValidation() {
  console.log('🧪 Testing Group Chat Validation...\n');

  try {
    // Login a test user
    const token = await loginUser('ishwor123');
    if (!token) {
      throw new Error('Failed to login test user');
    }

    // Test 1: Try to create group chat with only 1 participant (should fail)
    console.log('📝 Test 1: Creating group chat with 1 participant (should fail)...');
    try {
      await axios.post(`${BASE_URL}/conversations/group`, {
        participantIds: ['bhuwan-uuid'], // Only 1 participant + creator = 2 total (should fail)
        name: 'Test Group'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('❌ Test 1 FAILED: Group chat with 2 total participants was allowed');
      return false;
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Test 1 PASSED: Group chat with 2 total participants was rejected');
      } else {
        console.log('❌ Test 1 FAILED: Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }

    // Test 2: Create group chat with 3 participants (should succeed)
    console.log('\n📝 Test 2: Creating group chat with 3 participants (should succeed)...');
    try {
      const response = await axios.post(`${BASE_URL}/conversations/group`, {
        participantIds: ['bhuwan-uuid', 'test-uuid'], // 2 participants + creator = 3 total (should work)
        name: 'Test Group Chat'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Test 2 PASSED: Group chat with 3 participants was created');
      console.log(`   Conversation ID: ${response.data.id}`);
      
      // Test 3: Send message to group chat
      console.log('\n📝 Test 3: Sending message to group chat...');
      const messageResponse = await axios.post(`${BASE_URL}/conversations/${response.data.id}/messages`, {
        content: 'Hello group!',
        type: 'text'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Test 3 PASSED: Message sent to group chat');
      console.log(`   Message ID: ${messageResponse.data.id}`);
      
      return true;
    } catch (error) {
      console.log('❌ Test 2 FAILED: Could not create group chat with 3 participants');
      console.error('   Error:', error.response?.data || error.message);
      return false;
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    return false;
  }
}

async function testDirectChatStillWorks() {
  console.log('\n🧪 Testing Direct Chat Still Works...\n');

  try {
    const token = await loginUser('ishwor123');
    if (!token) {
      throw new Error('Failed to login test user');
    }

    // Create direct chat with 2 participants (should work)
    console.log('📝 Creating direct chat with 2 participants...');
    const response = await axios.post(`${BASE_URL}/conversations/direct`, {
      targetUserId: 'bhuwan-uuid'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Direct chat created successfully');
    console.log(`   Conversation ID: ${response.data.id}`);
    return true;

  } catch (error) {
    console.log('❌ Direct chat test FAILED:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Group Chat Validation Test Suite...\n');

  const groupChatTest = await testGroupChatValidation();
  const directChatTest = await testDirectChatStillWorks();

  console.log('\n📊 TEST RESULTS:');
  console.log(`Group Chat Validation: ${groupChatTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Direct Chat Functionality: ${directChatTest ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = groupChatTest && directChatTest;
  console.log(`\n🎯 OVERALL RESULT: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  process.exit(allPassed ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Test suite interrupted');
  process.exit(1);
});

// Run the tests
runTests();