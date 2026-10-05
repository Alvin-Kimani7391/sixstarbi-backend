const winston = require('winston');
const env = require('./env');

const logger = winston.createLogger({
  level: env.isProd ? 'info' : 'debug',
  silent: env.isTest,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.isProd
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) =>
            `${timestamp} ${level}: ${stack || message}`
          )
        )
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;