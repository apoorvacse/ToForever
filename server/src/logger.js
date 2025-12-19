/**
 * Production-safe logger utility
 * Only logs errors in production, all logs in development
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  info: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
};

