// lib/model.js - Database models and configuration
import { Sequelize, DataTypes } from 'sequelize';
// import dotenv from 'dotenv';

// dotenv.config({ path: '.env.local' });

// Database configuration from environment variables
const {
  DB_HOST='sql12.freesqldatabase.com',
  DB_PORT=3306,
  DB_NAME='sql12790404',
  DB_USER='sql12790404',
  DB_PASSWORD='Akl1EQfJJ1',
  NODE_ENV = 'development'
} = process.env;

// SendStatus enum
const SendStatus = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED'
};

// Create Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: parseInt(DB_PORT),
  dialect: 'mysql',
  logging: NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
});

// Define Recipient model
const Recipient = sequelize.define('Recipient', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(...Object.values(SendStatus)),
    allowNull: false,
    defaultValue: SendStatus.PENDING,
  },
}, {
  tableName: 'recipients',
  indexes: [
    {
      fields: ['email'],
      unique: true,
    },
    {
      fields: ['status'],
    },
  ],
});

// Define QueueState model (singleton)
const QueueState = sequelize.define('QueueState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    defaultValue: 1,
  },
  isSendingProcessActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  lastUpdated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'queue_state',
});

// Initialize default queue state
const initializeQueueState = async () => {
  try {
    const [queueState] = await QueueState.findOrCreate({
      where: { id: 1 },
      defaults: {
        id: 1,
        isSendingProcessActive: false,
        lastUpdated: new Date(),
      },
    });
    console.log('Queue state initialized:', queueState.toJSON());
    return queueState;
  } catch (error) {
    console.error('Error initializing queue state:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

// Sync database (create tables)
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database:', error);
    throw error;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Export everything using CommonJS
export {
  sequelize,
  Recipient,
  QueueState,
  SendStatus,
  initializeQueueState,
  testConnection,
  syncDatabase,
  closeConnection
};