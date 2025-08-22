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
  logging: true,
});

const users = [
  {
    id: 'afc70db3-6f43-4882-92fd-4715f25ffc95',
    kahaId: 'U-8C695E',
    name: 'Ishwor'
  },
  {
    id: 'c5c3d135-4968-450b-9fca-57f01e0055f7',
    kahaId: 'U-7A14FA',
    name: 'Bhuwan'
  }
];

async function seedUsers() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    
    console.log('👥 Seeding Ishwor and Bhuwan users...');
    
    for (const userData of users) {
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
          console.log(`✅ Created user: ${userData.name}`);
          console.log(`   ID: ${userData.id}`);
          console.log(`   KahaID: ${userData.kahaId}`);
        } else {
          // Update existing user's kahaId if needed
          await dataSource.query(
            'UPDATE users SET "kahaId" = $1, "updatedAt" = NOW() WHERE id = $2',
            [userData.kahaId, userData.id]
          );
          console.log(`👤 Updated existing user: ${userData.name}`);
          console.log(`   ID: ${userData.id}`);
          console.log(`   KahaID: ${userData.kahaId}`);
        }
      } catch (error) {
        console.log(`❌ Error with user ${userData.name}: ${error.message}`);
      }
    }
    
    console.log('\n📊 Users Summary:');
    console.log('='.repeat(60));
    console.log('1. Ishwor');
    console.log('   ID: afc70db3-6f43-4882-92fd-4715f25ffc95');
    console.log('   KahaID: U-8C695E');
    console.log('   JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFmYzcwZGIzLTZmNDMtNDg4Mi05MmZkLTQ3MTVmMjVmZmM5NSIsImthaGFJZCI6IlUtOEM2OTVFIiwiaWF0IjoxNzUzMzIzMTU4fQ.9EBmn6ntE7pqjL8EmctLT4MTxiG9VVgvnncAeZxD2yU');
    console.log('');
    console.log('2. Bhuwan');
    console.log('   ID: c5c3d135-4968-450b-9fca-57f01e0055f7');
    console.log('   KahaID: U-7A14FA');
    console.log('   JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM1YzNkMTM1LTQ5NjgtNDUwYi05ZmNhLTU3ZjAxZTAwNTVmNyIsImthaGFJZCI6IlUtN0ExNEZBIiwiaWF0IjoxNzU1Njg0NjY2fQ.rQwE_31-jT358Mqs02T6LcPa4Rxv3WTC8C0Q-1_grpE');
    console.log('');
    
    // Verify users in database
    const allUsers = await dataSource.query('SELECT id, "kahaId" FROM users ORDER BY "createdAt"');
    console.log('📋 All users in database:');
    allUsers.forEach((user, index) => {
      const userName = user.id === 'afc70db3-6f43-4882-92fd-4715f25ffc95' ? 'Ishwor' : 
                      user.id === 'c5c3d135-4968-450b-9fca-57f01e0055f7' ? 'Bhuwan' : 'Other';
      console.log(`${index + 1}. ${userName}: ${user.id} (${user.kahaId})`);
    });
    
    await dataSource.destroy();
    console.log('\n✅ User seeding completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedUsers();