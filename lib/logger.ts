/**
 * Environment-aware logging utility
 * Use this instead of console.log/error/warn for better production control
 */

type LogLevel = 'log' | 'error' | 'warn' | 'debug';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Logs a message only in development mode
 */
export function devLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Logs an error (always logged, but with more detail in development)
 */
export function logError(message: string, error?: unknown): void {
  if (isDevelopment && error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
}

/**
 * Logs a warning (always logged, but with more detail in development)
 */
export function logWarning(message: string, details?: unknown): void {
  if (isDevelopment && details) {
    console.warn(message, details);
  } else {
    console.warn(message);
  }
}

/**
 * Logs debug information (only in development)
 */
export function debugLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.debug(...args);
  }
}

/**
 * Conditional logging based on log level
 */
export function log(level: LogLevel, ...args: unknown[]): void {
  if (level === 'error' || level === 'warn') {
    // Always log errors and warnings
    console[level](...args);
  } else if (isDevelopment) {
    // Only log debug/info in development
    console[level](...args);
  }
}
