const { DataSource } = require('typeorm');
require('dotenv').config();

// Import compiled entities
const { User } = require('../dist/src/database/entities/user.entity');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: false,
  entities: [User],
});

async function createThirdUser() {
  try {
    await dataSource.initialize();
    
    const userRepository = dataSource.getRepository(User);
    
    // Create third test user
    const existingUser3 = await userRepository.findOne({ 
      where: { id: '87654321-4321-4321-4321-210987654321' } 
    });
    
    if (!existingUser3) {
      console.log('👤 Creating third test user...');
      const testUser3 = userRepository.create({
        id: '87654321-4321-4321-4321-210987654321',
        kahaId: '87654321-4321-4321-4321-210987654321',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await userRepository.save(testUser3);
      console.log('✅ Third test user created');
    } else {
      console.log('👥 Third user already exists');
    }

    await dataSource.destroy();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

createThirdUser();