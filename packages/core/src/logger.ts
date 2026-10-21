import type { Logger } from './types';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

export interface LoggerOptions {
  level?: Level;
  fields?: Record<string, unknown>;
  pretty?: boolean;
}

function write(level: Level, message: string, fields: Record<string, unknown>, pretty: boolean) {
  const timestamp = new Date().toISOString();
  if (pretty) {
    const suffix = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](
      `${timestamp} ${level.toUpperCase()} ${message}${suffix}`,
    );
    return;
  }
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](
    JSON.stringify({ level, time: timestamp, message, ...fields }),
  );
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const threshold = LEVELS[options.level ?? 'info'];
  const pretty = options.pretty ?? process.env.NODE_ENV !== 'production';

  const logger: Logger = {
    debug(message, fields = {}) {
      if (LEVELS.debug >= threshold)
        write('debug', message, { ...options.fields, ...fields }, pretty);
    },
    info(message, fields = {}) {
      if (LEVELS.info >= threshold)
        write('info', message, { ...options.fields, ...fields }, pretty);
    },
    warn(message, fields = {}) {
      if (LEVELS.warn >= threshold)
        write('warn', message, { ...options.fields, ...fields }, pretty);
    },
    error(message, fields = {}) {
      if (LEVELS.error >= threshold)
        write('error', message, { ...options.fields, ...fields }, pretty);
    },
    child(fields) {
      return createLogger({ ...options, fields: { ...options.fields, ...fields } });
    },
  };

  return logger;
}

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};
