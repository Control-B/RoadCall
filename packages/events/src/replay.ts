import {
  EventBridgeClient,
  StartReplayCommand,
  DescribeReplayCommand,
  CancelReplayCommand,
  ListReplaysCommand,
  ReplayState,
} from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'event-replay' });

export interface ReplayOptions {
  archiveName: string;
  replayName: string;
  eventSourceArn: string;
  startTime: Date;
  endTime: Date;
  description?: string;
}

export interface ReplayStatus {
  replayName: string;
  state: ReplayState | string;
  eventStartTime?: Date;
  eventEndTime?: Date;
  eventLastReplayedTime?: Date;
  replayStartTime?: Date;
  replayEndTime?: Date;
}

export class EventReplay {
  private client: EventBridgeClient;

  constructor(region?: string) {
    this.client = new EventBridgeClient({ region: region || process.env.AWS_REGION });
  }

  /**
   * Start replaying events from archive
   */
  async startReplay(options: ReplayOptions): Promise<string> {
    const { archiveName, replayName, eventSourceArn, startTime, endTime, description } = options;

    try {
      logger.info('Starting event replay', {
        replayName,
        archiveName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const command = new StartReplayCommand({
        ReplayName: replayName,
        EventSourceArn: eventSourceArn,
        EventStartTime: startTime,
        EventEndTime: endTime,
        Destination: {
          Arn: eventSourceArn,
        },
        Description: description || `Replay from ${startTime.toISOString()} to ${endTime.toISOString()}`,
      });

      const response = await this.client.send(command);

      logger.info('Replay started successfully', {
        replayName,
        replayArn: response.ReplayArn,
        state: response.State,
      });

      return response.ReplayArn!;
    } catch (error) {
      logger.error('Failed to start replay', {
        error,
        replayName,
      });
      throw error;
    }
  }

  /**
   * Get replay status
   */
  async getReplayStatus(replayName: string): Promise<ReplayStatus> {
    try {
      const command = new DescribeReplayCommand({
        ReplayName: replayName,
      });

      const response = await this.client.send(command);

      return {
        replayName: response.ReplayName!,
        state: response.State!,
        eventStartTime: response.EventStartTime,
        eventEndTime: response.EventEndTime,
        eventLastReplayedTime: response.EventLastReplayedTime,
        replayStartTime: response.ReplayStartTime,
        replayEndTime: response.ReplayEndTime,
      };
    } catch (error) {
      logger.error('Failed to get replay status', {
        error,
        replayName,
      });
      throw error;
    }
  }

  /**
   * Cancel an ongoing replay
   */
  async cancelReplay(replayName: string): Promise<void> {
    try {
      logger.info('Cancelling replay', { replayName });

      const command = new CancelReplayCommand({
        ReplayName: replayName,
      });

      await this.client.send(command);

      logger.info('Replay cancelled successfully', { replayName });
    } catch (error) {
      logger.error('Failed to cancel replay', {
        error,
        replayName,
      });
      throw error;
    }
  }

  /**
   * List all replays
   */
  async listReplays(state?: ReplayState): Promise<ReplayStatus[]> {
    try {
      const command = new ListReplaysCommand({
        State: state,
      });

      const response = await this.client.send(command);

      return (response.Replays || []).map((replay) => ({
        replayName: replay.ReplayName!,
        state: replay.State!,
        eventStartTime: replay.EventStartTime,
        eventEndTime: replay.EventEndTime,
        eventLastReplayedTime: replay.EventLastReplayedTime,
        replayStartTime: replay.ReplayStartTime,
        replayEndTime: replay.ReplayEndTime,
      }));
    } catch (error) {
      logger.error('Failed to list replays', { error });
      throw error;
    }
  }

  /**
   * Wait for replay to complete
   */
  async waitForReplayCompletion(
    replayName: string,
    maxWaitTimeMs: number = 300000, // 5 minutes default
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<ReplayStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTimeMs) {
      const status = await this.getReplayStatus(replayName);

      if (status.state === 'COMPLETED') {
        logger.info('Replay completed successfully', { replayName });
        return status;
      }

      if (status.state === 'FAILED' || status.state === 'CANCELLED') {
        logger.error('Replay did not complete successfully', {
          replayName,
          state: status.state,
        });
        throw new Error(`Replay ${replayName} ${status.state}`);
      }

      // Still running, wait and check again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Replay ${replayName} did not complete within ${maxWaitTimeMs}ms`);
  }
}

/**
 * Create a singleton instance
 */
let replayInstance: EventReplay | null = null;

export function getEventReplay(): EventReplay {
  if (!replayInstance) {
    replayInstance = new EventReplay();
  }
  return replayInstance;
}
