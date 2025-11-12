import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { v4 as uuidv4 } from 'uuid';
import { BaseEventDetail } from './schemas';

const logger = new Logger({ serviceName: 'event-publisher' });

export interface PublishEventOptions {
  eventBusName?: string;
  source: string;
  detailType: string;
  detail: BaseEventDetail;
  resources?: string[];
}

export class EventPublisher {
  private client: EventBridgeClient;
  private eventBusName: string;

  constructor(eventBusName?: string, region?: string) {
    this.client = new EventBridgeClient({ region: region || process.env.AWS_REGION });
    this.eventBusName = eventBusName || process.env.EVENT_BUS_NAME || 'roadcall-events';
  }

  /**
   * Publish a single event to EventBridge
   */
  async publishEvent(options: PublishEventOptions): Promise<void> {
    const { source, detailType, detail, resources } = options;

    // Ensure event has required fields
    const enrichedDetail = {
      ...detail,
      eventId: detail.eventId || uuidv4(),
      timestamp: detail.timestamp || new Date().toISOString(),
      version: detail.version || '1.0',
    };

    const entry: PutEventsRequestEntry = {
      EventBusName: options.eventBusName || this.eventBusName,
      Source: source,
      DetailType: detailType,
      Detail: JSON.stringify(enrichedDetail),
      Resources: resources,
      Time: new Date(),
    };

    try {
      logger.info('Publishing event', {
        source,
        detailType,
        eventId: enrichedDetail.eventId,
      });

      const command = new PutEventsCommand({
        Entries: [entry],
      });

      const response = await this.client.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const failedEntry = response.Entries?.[0];
        logger.error('Failed to publish event', {
          errorCode: failedEntry?.ErrorCode,
          errorMessage: failedEntry?.ErrorMessage,
          source,
          detailType,
        });
        throw new Error(`Failed to publish event: ${failedEntry?.ErrorMessage}`);
      }

      logger.info('Event published successfully', {
        source,
        detailType,
        eventId: enrichedDetail.eventId,
      });
    } catch (error) {
      logger.error('Error publishing event', {
        error,
        source,
        detailType,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch (max 10 per batch)
   */
  async publishEvents(events: PublishEventOptions[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // EventBridge supports max 10 events per PutEvents call
    const batches = this.chunkArray(events, 10);

    for (const batch of batches) {
      const entries: PutEventsRequestEntry[] = batch.map((event) => {
        const enrichedDetail = {
          ...event.detail,
          eventId: event.detail.eventId || uuidv4(),
          timestamp: event.detail.timestamp || new Date().toISOString(),
          version: event.detail.version || '1.0',
        };

        return {
          EventBusName: event.eventBusName || this.eventBusName,
          Source: event.source,
          DetailType: event.detailType,
          Detail: JSON.stringify(enrichedDetail),
          Resources: event.resources,
          Time: new Date(),
        };
      });

      try {
        logger.info('Publishing batch of events', {
          count: entries.length,
        });

        const command = new PutEventsCommand({
          Entries: entries,
        });

        const response = await this.client.send(command);

        if (response.FailedEntryCount && response.FailedEntryCount > 0) {
          logger.error('Some events failed to publish', {
            failedCount: response.FailedEntryCount,
            failures: response.Entries?.filter((e) => e.ErrorCode),
          });
          throw new Error(`Failed to publish ${response.FailedEntryCount} events`);
        }

        logger.info('Batch published successfully', {
          count: entries.length,
        });
      } catch (error) {
        logger.error('Error publishing batch', {
          error,
          batchSize: entries.length,
        });
        throw error;
      }
    }
  }

  /**
   * Helper to chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Create a singleton instance for Lambda functions
 */
let publisherInstance: EventPublisher | null = null;

export function getEventPublisher(eventBusName?: string): EventPublisher {
  if (!publisherInstance) {
    publisherInstance = new EventPublisher(eventBusName);
  }
  return publisherInstance;
}
