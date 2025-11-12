import { EventBridgeEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '@roadcall/utils';

interface SecretRotationDetail {
  eventName: string;
  requestParameters?: {
    secretId?: string;
  };
  responseElements?: {
    ARN?: string;
    name?: string;
  };
  userIdentity?: {
    principalId?: string;
    arn?: string;
  };
}

const snsClient = new SNSClient({});
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const STAGE = process.env.STAGE || 'dev';

export const handler = async (
  event: EventBridgeEvent<'AWS API Call via CloudTrail', SecretRotationDetail>
): Promise<void> => {
  try {
    logger.info('Processing secret rotation event', { event });

    const { detail } = event;
    const secretId = detail.requestParameters?.secretId || detail.responseElements?.ARN || 'Unknown';
    const secretName = detail.responseElements?.name || secretId;
    const eventName = detail.eventName;
    const principal = detail.userIdentity?.principalId || 'System';

    // Construct notification message
    const subject = `[${STAGE.toUpperCase()}] Secret Rotation Event: ${eventName}`;
    const message = `
Secret Rotation Event Detected
================================

Environment: ${STAGE}
Event: ${eventName}
Secret: ${secretName}
Secret ARN: ${secretId}
Principal: ${principal}
Timestamp: ${event.time}

Details:
${JSON.stringify(detail, null, 2)}

Action Required:
- Verify that dependent services have been updated with new credentials
- Check application logs for any authentication failures
- Confirm all Lambda functions are using the latest secret values

This is an automated notification from the Roadcall Secrets Manager monitoring system.
    `.trim();

    // Publish to SNS
    await snsClient.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: subject,
        Message: message,
      })
    );

    logger.info('Secret rotation notification sent', {
      secretName,
      eventName,
    });
  } catch (error) {
    logger.error('Failed to send secret rotation notification', error as Error, {
      event,
    });
    throw error;
  }
};
