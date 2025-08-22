const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU';

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testConversations() {
  try {
    console.log('Testing GET /conversations...');
    const response = await axios.get(`${BASE_URL}/conversations`, { headers });
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error details:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message);
    console.log('Full error:', error.response?.data);
  }
}

async function testDirectConversation() {
  try {
    console.log('\nTesting POST /conversations/direct...');
    const data = {
      targetUserId: '12345678-1234-4234-8234-123456789012' // Valid UUID v4
    };
    const response = await axios.post(`${BASE_URL}/conversations/direct`, data, { headers });
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error details:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message);
    console.log('Full error:', error.response?.data);
  }
}

testConversations().then(() => testDirectConversation());