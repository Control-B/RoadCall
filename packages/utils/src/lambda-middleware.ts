import { Context, Handler } from 'aws-lambda';
import { Logger, createLogger } from './logger';
import { MetricsPublisher, createMetricsPublisher } from './metrics';
import * as AWSXRay from 'aws-xray-sdk-core';

export interface MiddlewareConfig {
  serviceName: string;
  environment?: string;
  enableXRay?: boolean;
  enableMetrics?: boolean;
  captureAWSClients?: boolean;
}

export interface EnhancedContext extends Context {
  logger: Logger;
  metrics?: MetricsPublisher;
}

/**
 * Wrap Lambda handler with observability middleware
 */
export function withObservability<TEvent = any, TResult = any>(
  config: MiddlewareConfig,
  handler: (event: TEvent, context: EnhancedContext) => Promise<TResult>
): Handler<TEvent, TResult> {
  const logger = createLogger(config.serviceName, config.environment);
  
  let metrics: MetricsPublisher | undefined;
  if (config.enableMetrics !== false) {
    const namespace = `${config.serviceName}/${config.environment || 'dev'}`;
    metrics = createMetricsPublisher(namespace, [
      { Name: 'Service', Value: config.serviceName },
      { Name: 'Environment', Value: config.environment || 'dev' },
    ]);
  }

  // Enable X-Ray tracing for AWS SDK clients
  if (config.enableXRay !== false && config.captureAWSClients !== false) {
    const AWS = require('aws-sdk');
    AWSXRay.captureAWS(AWS);
  }

  return async (event: TEvent, context: Context): Promise<TResult> => {
    const startTime = Date.now();
    logger.setContext(context);

    // Create enhanced context
    const enhancedContext: EnhancedContext = {
      ...context,
      logger,
      metrics,
    };

    logger.info('Lambda invocation started', {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      requestId: context.awsRequestId,
      eventType: (event as any)?.['detail-type'] || typeof event,
    });

    try {
      // Execute handler
      const result = await handler(event, enhancedContext);

      const duration = Date.now() - startTime;
      logger.info('Lambda invocation completed', {
        functionName: context.functionName,
        requestId: context.awsRequestId,
        durationMs: duration,
      });

      // Record success metric
      if (metrics) {
        await metrics.recordCount('Invocations', 1, [
          { Name: 'Status', Value: 'Success' },
        ]);
        await metrics.recordDuration('Duration', duration);
        await metrics.flush();
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Lambda invocation failed', error as Error, {
        functionName: context.functionName,
        requestId: context.awsRequestId,
        durationMs: duration,
      });

      // Record error metric
      if (metrics) {
        await metrics.recordCount('Invocations', 1, [
          { Name: 'Status', Value: 'Error' },
        ]);
        await metrics.recordCount('Errors', 1, [
          { Name: 'ErrorType', Value: (error as Error).name },
        ]);
        await metrics.flush();
      }

      throw error;
    }
  };
}

/**
 * Create X-Ray subsegment for custom operations
 */
export function traceOperation<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  if (!AWSXRay.getSegment()) {
    // X-Ray not enabled, just execute operation
    return operation();
  }

  return new Promise((resolve, reject) => {
    AWSXRay.captureAsyncFunc(name, async (subsegment) => {
      try {
        if (metadata && subsegment) {
          subsegment.addMetadata('metadata', metadata);
        }

        const result = await operation();

        if (subsegment) {
          subsegment.close();
        }

        resolve(result);
      } catch (error) {
        if (subsegment) {
          subsegment.addError(error as Error);
          subsegment.close();
        }
        reject(error);
      }
    });
  });
}

/**
 * Trace AWS SDK calls
 */
export function traceAWSCall<T>(
  serviceName: string,
  operation: string,
  call: () => Promise<T>
): Promise<T> {
  return traceOperation(`AWS.${serviceName}.${operation}`, call, {
    service: serviceName,
    operation,
  });
}

/**
 * Trace HTTP calls
 */
export function traceHttpCall<T>(
  url: string,
  method: string,
  call: () => Promise<T>
): Promise<T> {
  return traceOperation(`HTTP.${method}`, call, {
    url,
    method,
  });
}

/**
 * Trace database operations
 */
export function traceDbOperation<T>(
  table: string,
  operation: string,
  call: () => Promise<T>
): Promise<T> {
  return traceOperation(`DB.${operation}`, call, {
    table,
    operation,
  });
}
