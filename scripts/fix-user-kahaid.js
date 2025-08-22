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

async function fixUserKahaId() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    
    // First, alter the column type from uuid to varchar
    console.log('🔧 Changing kahaId column type from uuid to varchar...');
    await dataSource.query('ALTER TABLE users ALTER COLUMN "kahaId" TYPE varchar USING "kahaId"::varchar');
    
    // Update the existing user with the correct kahaId from JWT
    console.log('👤 Updating user kahaId...');
    await dataSource.query(
      'UPDATE users SET "kahaId" = $1 WHERE id = $2',
      ['U-8C695E', 'afc70db3-6f43-4882-92fd-4715f25ffc95']
    );
    
    console.log('✅ User kahaId fixed successfully');
    
    await dataSource.destroy();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

fixUserKahaId();