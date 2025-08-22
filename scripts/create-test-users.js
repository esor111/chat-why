const { DataSource } = require('typeorm');
require('dotenv').config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: false,
});

const testUsers = [
  {
    id: 'afc70db3-6f43-4882-92fd-4715f25ffc95',
    kahaId: 'U-8C695E',
    name: 'Alice (Main User)'
  },
  {
    id: '12345678-1234-4234-8234-123456789012',
    kahaId: 'U-TEST2',
    name: 'Bob (Test User 2)'
  },
  {
    id: '87654321-4321-4321-4321-210987654321',
    kahaId: 'U-TEST3',
    name: 'Charlie (Test User 3)'
  },
  {
    id: '11111111-2222-4333-8444-555555555555',
    kahaId: 'U-TEST4',
    name: 'Diana (Test User 4)'
  },
  {
    id: '99999999-8888-4777-8666-555555555555',
    kahaId: 'U-TEST5',
    name: 'Eve (Test User 5)'
  }
];

async function createTestUsers() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    
    console.log('👥 Creating test users...');
    
    for (const userData of testUsers) {
      try {
        // Check if user exists
        const existingUser = await dataSource.query(
          'SELECT id FROM users WHERE id = $1',
          [userData.id]
        );
        
        if (existingUser.length === 0) {
          // Create new user
          await dataSource.query(
            'INSERT INTO users (id, "kahaId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
            [userData.id, userData.kahaId]
          );
          console.log(`✅ Created user: ${userData.name} (${userData.id})`);
        } else {
          console.log(`👤 User already exists: ${userData.name} (${userData.id})`);
        }
      } catch (error) {
        console.log(`❌ Error creating user ${userData.name}: ${error.message}`);
      }
    }
    
    console.log('\n📊 Test Users Summary:');
    console.log('='.repeat(60));
    testUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   KahaID: ${user.kahaId}`);
      console.log('');
    });
    
    console.log('🎯 Testing Scenarios:');
    console.log('• 1-on-1 Chat: Alice ↔ Bob');
    console.log('• Group Chat: Alice + Bob + Charlie (3+ participants)');
    console.log('• Business Chat: Alice ↔ Business Support');
    console.log('• Multi-user Group: Alice + Bob + Charlie + Diana + Eve');
    
    await dataSource.destroy();
    console.log('\n✅ Test users setup completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

createTestUsers();