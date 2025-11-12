import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

export interface MetricDimension {
  Name: string;
  Value: string;
}

export interface MetricData {
  metricName: string;
  value: number;
  unit?: MetricUnit;
  dimensions?: MetricDimension[];
  timestamp?: Date;
}

export enum MetricUnit {
  SECONDS = 'Seconds',
  MICROSECONDS = 'Microseconds',
  MILLISECONDS = 'Milliseconds',
  BYTES = 'Bytes',
  KILOBYTES = 'Kilobytes',
  MEGABYTES = 'Megabytes',
  GIGABYTES = 'Gigabytes',
  TERABYTES = 'Terabytes',
  BITS = 'Bits',
  KILOBITS = 'Kilobits',
  MEGABITS = 'Megabits',
  GIGABITS = 'Gigabits',
  TERABITS = 'Terabits',
  PERCENT = 'Percent',
  COUNT = 'Count',
  BYTES_PER_SECOND = 'Bytes/Second',
  KILOBYTES_PER_SECOND = 'Kilobytes/Second',
  MEGABYTES_PER_SECOND = 'Megabytes/Second',
  GIGABYTES_PER_SECOND = 'Gigabytes/Second',
  TERABYTES_PER_SECOND = 'Terabytes/Second',
  BITS_PER_SECOND = 'Bits/Second',
  KILOBITS_PER_SECOND = 'Kilobits/Second',
  MEGABITS_PER_SECOND = 'Megabits/Second',
  GIGABITS_PER_SECOND = 'Gigabits/Second',
  TERABITS_PER_SECOND = 'Terabits/Second',
  COUNT_PER_SECOND = 'Count/Second',
  NONE = 'None',
}

export class MetricsPublisher {
  private cloudwatch: CloudWatch;
  private namespace: string;
  private defaultDimensions: MetricDimension[];
  private buffer: MetricData[] = [];
  private bufferSize: number = 20;
  private flushInterval: number = 60000; // 60 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(
    namespace: string,
    defaultDimensions: MetricDimension[] = [],
    region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    this.cloudwatch = new CloudWatch({ region });
    this.namespace = namespace;
    this.defaultDimensions = defaultDimensions;

    // Auto-flush on interval
    this.startAutoFlush();
  }

  /**
   * Publish a single metric
   */
  public async putMetric(data: MetricData): Promise<void> {
    this.buffer.push(data);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Publish multiple metrics
   */
  public async putMetrics(metrics: MetricData[]): Promise<void> {
    this.buffer.push(...metrics);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered metrics to CloudWatch
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const metricsToSend = this.buffer.splice(0, this.bufferSize);

    try {
      await this.cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metricsToSend.map((metric) => ({
          MetricName: metric.metricName,
          Value: metric.value,
          Unit: metric.unit || MetricUnit.COUNT,
          Timestamp: metric.timestamp || new Date(),
          Dimensions: [
            ...this.defaultDimensions,
            ...(metric.dimensions || []),
          ],
        })),
      });

      logger.debug('Metrics published successfully', {
        count: metricsToSend.length,
        namespace: this.namespace,
      });
    } catch (error) {
      logger.error('Failed to publish metrics', error as Error, {
        count: metricsToSend.length,
        namespace: this.namespace,
      });

      // Put metrics back in buffer for retry
      this.buffer.unshift(...metricsToSend);
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        logger.error('Auto-flush failed', error as Error);
      });
    }, this.flushInterval);

    // Ensure timer doesn't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop auto-flush and flush remaining metrics
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  /**
   * Record a count metric
   */
  public async recordCount(
    metricName: string,
    value: number = 1,
    dimensions?: MetricDimension[]
  ): Promise<void> {
    await this.putMetric({
      metricName,
      value,
      unit: MetricUnit.COUNT,
      dimensions,
    });
  }

  /**
   * Record a duration metric
   */
  public async recordDuration(
    metricName: string,
    durationMs: number,
    dimensions?: MetricDimension[]
  ): Promise<void> {
    await this.putMetric({
      metricName,
      value: durationMs,
      unit: MetricUnit.MILLISECONDS,
      dimensions,
    });
  }

  /**
   * Record a percentage metric
   */
  public async recordPercentage(
    metricName: string,
    percentage: number,
    dimensions?: MetricDimension[]
  ): Promise<void> {
    await this.putMetric({
      metricName,
      value: percentage,
      unit: MetricUnit.PERCENT,
      dimensions,
    });
  }

  /**
   * Create a timer for duration metrics
   */
  public startTimer(metricName: string, dimensions?: MetricDimension[]): () => Promise<void> {
    const startTime = Date.now();
    return async () => {
      const duration = Date.now() - startTime;
      await this.recordDuration(metricName, duration, dimensions);
    };
  }
}

/**
 * Business KPI metrics helper
 */
export class BusinessMetrics {
  private metrics: MetricsPublisher;

  constructor(serviceName: string, environment: string) {
    const namespace = `${serviceName}/${environment}`;
    this.metrics = new MetricsPublisher(namespace, [
      { Name: 'Service', Value: serviceName },
      { Name: 'Environment', Value: environment },
    ]);
  }

  /**
   * Record incident created
   */
  public async recordIncidentCreated(incidentType: string): Promise<void> {
    await this.metrics.recordCount('IncidentsCreated', 1, [
      { Name: 'IncidentType', Value: incidentType },
    ]);
  }

  /**
   * Record incident completed
   */
  public async recordIncidentCompleted(incidentType: string): Promise<void> {
    await this.metrics.recordCount('IncidentsCompleted', 1, [
      { Name: 'IncidentType', Value: incidentType },
    ]);
  }

  /**
   * Record time to assign vendor (seconds)
   */
  public async recordTimeToAssign(seconds: number, incidentType: string): Promise<void> {
    await this.metrics.putMetric({
      metricName: 'TimeToAssign',
      value: seconds,
      unit: MetricUnit.SECONDS,
      dimensions: [{ Name: 'IncidentType', Value: incidentType }],
    });
  }

  /**
   * Record time to arrival (minutes)
   */
  public async recordTimeToArrival(minutes: number, incidentType: string): Promise<void> {
    await this.metrics.putMetric({
      metricName: 'TimeToArrival',
      value: minutes,
      unit: MetricUnit.SECONDS,
      dimensions: [{ Name: 'IncidentType', Value: incidentType }],
    });
  }

  /**
   * Record offer created
   */
  public async recordOfferCreated(vendorId: string): Promise<void> {
    await this.metrics.recordCount('OffersCreated', 1, [
      { Name: 'VendorId', Value: vendorId },
    ]);
  }

  /**
   * Record offer accepted
   */
  public async recordOfferAccepted(vendorId: string): Promise<void> {
    await this.metrics.recordCount('OffersAccepted', 1, [
      { Name: 'VendorId', Value: vendorId },
    ]);
  }

  /**
   * Record offer declined
   */
  public async recordOfferDeclined(vendorId: string, reason?: string): Promise<void> {
    await this.metrics.recordCount('OffersDeclined', 1, [
      { Name: 'VendorId', Value: vendorId },
      { Name: 'Reason', Value: reason || 'unknown' },
    ]);
  }

  /**
   * Record active incidents count
   */
  public async recordActiveIncidents(count: number): Promise<void> {
    await this.metrics.recordCount('ActiveIncidents', count);
  }

  /**
   * Record payment approval time (minutes)
   */
  public async recordPaymentApprovalTime(minutes: number): Promise<void> {
    await this.metrics.putMetric({
      metricName: 'PaymentApprovalTime',
      value: minutes,
      unit: MetricUnit.SECONDS,
    });
  }

  /**
   * Record payment processed
   */
  public async recordPaymentProcessed(amountCents: number, paymentType: string): Promise<void> {
    await this.metrics.recordCount('PaymentsProcessed', 1, [
      { Name: 'PaymentType', Value: paymentType },
    ]);

    await this.metrics.putMetric({
      metricName: 'PaymentAmount',
      value: amountCents / 100,
      unit: MetricUnit.NONE,
      dimensions: [{ Name: 'PaymentType', Value: paymentType }],
    });
  }

  /**
   * Record fraud detection score
   */
  public async recordFraudScore(score: number, flagged: boolean): Promise<void> {
    await this.metrics.putMetric({
      metricName: 'FraudScore',
      value: score,
      unit: MetricUnit.NONE,
      dimensions: [{ Name: 'Flagged', Value: flagged.toString() }],
    });
  }

  /**
   * Flush all buffered metrics
   */
  public async flush(): Promise<void> {
    await this.metrics.flush();
  }

  /**
   * Shutdown metrics publisher
   */
  public async shutdown(): Promise<void> {
    await this.metrics.shutdown();
  }
}

/**
 * Create a metrics publisher
 */
export function createMetricsPublisher(
  namespace: string,
  defaultDimensions?: MetricDimension[]
): MetricsPublisher {
  return new MetricsPublisher(namespace, defaultDimensions);
}

/**
 * Create business metrics helper
 */
export function createBusinessMetrics(serviceName: string, environment: string): BusinessMetrics {
  return new BusinessMetrics(serviceName, environment);
}
