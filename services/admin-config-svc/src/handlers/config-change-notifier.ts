import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });
const eventBridge = new EventBridgeClient({});

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'roadcall-events';

/**
 * Lambda function triggered by DynamoDB Streams to notify services of configuration changes
 * This enables hot-reload of configuration within 60 seconds
 */
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  try {
    logger.info('Processing configuration change events', {
      recordCount: event.Records.length,
    });

    const events = [];

    for (const record of event.Records) {
      // Only process INSERT and MODIFY events for latest configs
      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        const newImage = record.dynamodb?.NewImage;
        
        if (!newImage) {
          continue;
        }

        const config = unmarshall(newImage as Record<string, AttributeValue>);

        // Only notify for latest versions
        if (config.isLatest === 'true') {
          events.push({
            Source: 'roadcall.admin-config',
            DetailType: 'ConfigurationChanged',
            Detail: JSON.stringify({
              configKey: config.configKey,
              version: config.version,
              updatedBy: config.updatedBy,
              updatedAt: config.updatedAt,
              changeType: record.eventName === 'INSERT' ? 'created' : 'updated',
            }),
            EventBusName: EVENT_BUS_NAME,
          });

          logger.info('Configuration change detected', {
            configKey: config.configKey,
            version: config.version,
            changeType: record.eventName,
          });
        }
      }
    }

    // Publish events to EventBridge
    if (events.length > 0) {
      const command = new PutEventsCommand({
        Entries: events,
      });

      const result = await eventBridge.send(command);

      logger.info('Configuration change events published', {
        eventCount: events.length,
        failedCount: result.FailedEntryCount || 0,
      });

      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        logger.error('Some events failed to publish', {
          failures: result.Entries?.filter((e) => e.ErrorCode),
        });
      }
    }
  } catch (error) {
    logger.error('Error processing configuration change events', { error });
    throw error;
  }
};
