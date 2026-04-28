import { createLogger, format, transports } from 'winston';

import { config } from './config';

export const logger = createLogger({
  level: config.isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} | ${level.toUpperCase()} | ${stack ?? message}`;
    })
  ),
  transports: [new transports.Console()]
});
