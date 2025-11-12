"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventReplay = void 0;
exports.getEventReplay = getEventReplay;
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const logger_1 = require("@aws-lambda-powertools/logger");
const logger = new logger_1.Logger({ serviceName: 'event-replay' });
class EventReplay {
    client;
    constructor(region) {
        this.client = new client_eventbridge_1.EventBridgeClient({ region: region || process.env.AWS_REGION });
    }
    /**
     * Start replaying events from archive
     */
    async startReplay(options) {
        const { archiveName, replayName, eventSourceArn, startTime, endTime, description } = options;
        try {
            logger.info('Starting event replay', {
                replayName,
                archiveName,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            });
            const command = new client_eventbridge_1.StartReplayCommand({
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
            return response.ReplayArn;
        }
        catch (error) {
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
    async getReplayStatus(replayName) {
        try {
            const command = new client_eventbridge_1.DescribeReplayCommand({
                ReplayName: replayName,
            });
            const response = await this.client.send(command);
            return {
                replayName: response.ReplayName,
                state: response.State,
                eventStartTime: response.EventStartTime,
                eventEndTime: response.EventEndTime,
                eventLastReplayedTime: response.EventLastReplayedTime,
                replayStartTime: response.ReplayStartTime,
                replayEndTime: response.ReplayEndTime,
            };
        }
        catch (error) {
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
    async cancelReplay(replayName) {
        try {
            logger.info('Cancelling replay', { replayName });
            const command = new client_eventbridge_1.CancelReplayCommand({
                ReplayName: replayName,
            });
            await this.client.send(command);
            logger.info('Replay cancelled successfully', { replayName });
        }
        catch (error) {
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
    async listReplays(state) {
        try {
            const command = new client_eventbridge_1.ListReplaysCommand({
                State: state,
            });
            const response = await this.client.send(command);
            return (response.Replays || []).map((replay) => ({
                replayName: replay.ReplayName,
                state: replay.State,
                eventStartTime: replay.EventStartTime,
                eventEndTime: replay.EventEndTime,
                eventLastReplayedTime: replay.EventLastReplayedTime,
                replayStartTime: replay.ReplayStartTime,
                replayEndTime: replay.ReplayEndTime,
            }));
        }
        catch (error) {
            logger.error('Failed to list replays', { error });
            throw error;
        }
    }
    /**
     * Wait for replay to complete
     */
    async waitForReplayCompletion(replayName, maxWaitTimeMs = 300000, // 5 minutes default
    pollIntervalMs = 5000 // 5 seconds
    ) {
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
exports.EventReplay = EventReplay;
/**
 * Create a singleton instance
 */
let replayInstance = null;
function getEventReplay() {
    if (!replayInstance) {
        replayInstance = new EventReplay();
    }
    return replayInstance;
}
//# sourceMappingURL=replay.js.map