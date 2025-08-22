const express = require('express');
const path = require('path');
const app = express();
const port = 3002;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Enable CORS for API calls
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Serve the main UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log(`🌐 Chat UI Server running on http://localhost:${port}`);
  console.log('📋 Features available:');
  console.log('  • 1-on-1 Direct Chats');
  console.log('  • Group Conversations (3+ participants)');
  console.log('  • Business Support Chats');
  console.log('  • Real-time WebSocket messaging');
  console.log('  • PostgreSQL data persistence');
  console.log('  • Redis profile caching');
  console.log('  • Typing indicators');
  console.log('  • Read receipts');
  console.log('  • Unread message counts');
  console.log('');
  console.log('🔧 Make sure these services are running:');
  console.log('  • Chat Backend API: http://localhost:3000');
  console.log('  • Mock kaha-main-v3: http://localhost:3001');
  console.log('  • PostgreSQL database');
  console.log('  • Redis server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down UI server...');
  process.exit(0);
});