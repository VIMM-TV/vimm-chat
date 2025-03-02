const { Sequelize } = require('sequelize');
const path = require('path');

// Determine database connection based on environment
const createSequelizeInstance = () => {
  // Use SQLite for testing
  if (process.env.DB_DIALECT === 'sqlite' || process.env.NODE_ENV === 'test') {
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../../vimm-chat.sqlite');
    console.log(`Using SQLite database at: ${dbPath}`);
    return new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: process.env.NODE_ENV !== 'production' ? console.log : false
    });
  } 
  
  // Use PostgreSQL for production/development (default)
  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV !== 'production' ? console.log : false
    }
  );
};

// Create Sequelize instance
const sequelize = createSequelizeInstance();

const initializeDb = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync all models
    await sequelize.sync();
    console.log('Database synchronized');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

module.exports = { sequelize, initializeDb };