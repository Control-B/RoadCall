import { Context } from 'aws-lambda';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogMetadata {
  [key: string]: any;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private serviceName: string;
  private environment: string;
  private minLevel: LogLevel;
  private context?: Context;

  constructor(serviceName: string, environment: string = process.env.ENVIRONMENT || 'dev') {
    this.serviceName = serviceName;
    this.environment = environment;
    this.minLevel = this.getMinLogLevel();
  }

  /**
   * Set Lambda context for request tracking
   */
  public setContext(context: Context): void {
    this.context = context;
  }

  /**
   * Log debug message
   */
  public debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  public info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log warning message
   */
  public warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error, metadata?: LogMetadata): void {
    const errorMetadata = error
      ? {
          ...metadata,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : metadata;

    this.log(LogLevel.ERROR, message, errorMetadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      requestId: this.context?.awsRequestId || this.getRequestIdFromEnv(),
      traceId: this.getTraceId(),
      metadata: this.sanitizeMetadata(metadata),
    };

    // Output as JSON for CloudWatch Logs Insights
    console.log(JSON.stringify(log));
  }

  /**
   * Determine if log should be output based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= currentLevelIndex;
  }

  /**
   * Get minimum log level from environment
   */
  private getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    return (envLevel as LogLevel) || LogLevel.INFO;
  }

  /**
   * Get request ID from environment (API Gateway)
   */
  private getRequestIdFromEnv(): string | undefined {
    return process.env.AWS_REQUEST_ID;
  }

  /**
   * Get X-Ray trace ID
   */
  private getTraceId(): string | undefined {
    const traceHeader = process.env._X_AMZN_TRACE_ID;
    if (!traceHeader) {
      return undefined;
    }

    // Extract trace ID from X-Ray header
    // Format: Root=1-5e645f3e-1234567890abcdef;Parent=abcdef;Sampled=1
    const match = traceHeader.match(/Root=([^;]+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
    if (!metadata) {
      return undefined;
    }

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'creditCard',
      'ssn',
      'otp',
    ];

    const sanitized: LogMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as LogMetadata);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Create a child logger with additional context
   */
  public child(additionalContext: LogMetadata): Logger {
    const childLogger = new Logger(this.serviceName, this.environment);
    childLogger.context = this.context;
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, metadata?: LogMetadata) => {
      originalLog(level, message, { ...additionalContext, ...metadata });
    };

    return childLogger;
  }

  /**
   * Log performance metric
   */
  public logPerformance(operation: string, durationMs: number, metadata?: LogMetadata): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      operation,
      durationMs,
      performanceMetric: true,
    });
  }

  /**
   * Create a timer for performance logging
   */
  public startTimer(operation: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.logPerformance(operation, duration);
    };
  }
}

/**
 * Create a logger instance
 */
export function createLogger(serviceName: string, environment?: string): Logger {
  return new Logger(serviceName, environment);
}

/**
 * Default logger instance
 */
export const logger = createLogger(
  process.env.SERVICE_NAME || 'roadcall-assistant',
  process.env.ENVIRONMENT
);
