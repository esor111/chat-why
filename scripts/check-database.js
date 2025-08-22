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

async function checkDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected successfully');

    // Check if users table exists and has data
    console.log('\n📊 Checking users table...');
    const userCount = await dataSource.query('SELECT COUNT(*) FROM users');
    console.log(`Users in database: ${userCount[0].count}`);

    if (userCount[0].count > 0) {
      const users = await dataSource.query('SELECT id, "kahaId", "createdAt" FROM users LIMIT 5');
      console.log('Sample users:');
      users.forEach(user => {
        console.log(`- ID: ${user.id}, KahaID: ${user.kahaId}, Created: ${user.createdAt}`);
      });
    }

    // Check conversations table
    console.log('\n💬 Checking conversations table...');
    const convCount = await dataSource.query('SELECT COUNT(*) FROM conversations');
    console.log(`Conversations in database: ${convCount[0].count}`);

    // Check participants table
    console.log('\n👥 Checking participants table...');
    const partCount = await dataSource.query('SELECT COUNT(*) FROM participants');
    console.log(`Participants in database: ${partCount[0].count}`);

    // Check messages table
    console.log('\n📨 Checking messages table...');
    const msgCount = await dataSource.query('SELECT COUNT(*) FROM messages');
    console.log(`Messages in database: ${msgCount[0].count}`);

    await dataSource.destroy();
    console.log('\n✅ Database check completed');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

checkDatabase();