const env = require('./config/env');
const logger = require('./config/logger');
const app = require('./app');
const { connectDatabase } = require('./config/database');

async function start() {
  await connectDatabase();
  const server = app.listen(env.PORT, () => {
    logger.info(`Six Star Intelligence API running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exit(1);
});

start().catch((err) => {
  logger.error(err);
  process.exit(1);
});