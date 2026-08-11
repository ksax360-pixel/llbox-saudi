require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/database');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required');
    }

    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`LLBox AI Backend running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`LLBox dummy mode: ${process.env.LLBOX_DUMMY_MODE !== 'false'}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

start();
