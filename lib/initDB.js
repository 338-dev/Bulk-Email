// scripts/initDatabase.ts
import { testConnection, syncDatabase, closeConnection } from './db.js';
import { initializeQueueState } from './model.js';

async function initializeDatabase() {
  console.log('🚀 Initializing Email Queue Database...');
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    // Sync database (create tables)
    console.log('🔨 Creating database tables...');
    await syncDatabase(false); // Set to true to force recreate tables
    
    // Initialize queue state
    console.log('⚙️  Initializing queue state...');
    await initializeQueueState();
    
    console.log('✅ Database initialization completed successfully!');
    
    // Show tables created
    console.log('\n📋 Tables created:');
    console.log('- recipients: Stores email recipients and their send status');
    console.log('- queue_state: Stores global queue state (sending status, etc.)');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
// if (require.main === module) {
  initializeDatabase();
// }

export { initializeDatabase };