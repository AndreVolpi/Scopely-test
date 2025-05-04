import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'prod' && process.env.NODE_ENV !== 'test';

export const logger = pino({
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
