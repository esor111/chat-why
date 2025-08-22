const { DataSource } = require('typeorm');
require('dotenv').config();

// Import compiled entities
const { User } = require('../dist/src/database/entities/user.entity');
const { Conversation } = require('../dist/src/database/entities/conversation.entity');
const { Message } = require('../dist/src/database/entities/message.entity');
const { Participant } = require('../dist/src/database/entities/participant.entity');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: true, // Enable synchronize to create tables
  logging: true,
  entities: [User, Conversation, Message, Participant],
});

async function setupDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected and tables synchronized');

    // Create a test user if none exists
    const userRepository = dataSource.getRepository(User);
    const userCount = await userRepository.count();
    
    if (userCount === 0) {
      console.log('👤 Creating test user...');
      const testUser = userRepository.create({
        id: 'afc70db3-6f43-4882-92fd-4715f25ffc95',
        kahaId: 'afc70db3-6f43-4882-92fd-4715f25ffc95', // Using UUID format
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await userRepository.save(testUser);
      console.log('✅ Test user created');
    } else {
      console.log(`👥 Found ${userCount} existing users`);
    }

    // Create another test user for conversations
    const existingUser2 = await userRepository.findOne({ 
      where: { id: '12345678-1234-4234-8234-123456789012' } 
    });
    
    if (!existingUser2) {
      console.log('👤 Creating second test user...');
      const testUser2 = userRepository.create({
        id: '12345678-1234-4234-8234-123456789012',
        kahaId: '12345678-1234-4234-8234-123456789012', // Using UUID format
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await userRepository.save(testUser2);
      console.log('✅ Second test user created');
    }

    await dataSource.destroy();
    console.log('✅ Database setup completed');

  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

setupDatabase();