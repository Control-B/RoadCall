import { ReplayState } from '@aws-sdk/client-eventbridge';
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
export declare class EventReplay {
    private client;
    constructor(region?: string);
    /**
     * Start replaying events from archive
     */
    startReplay(options: ReplayOptions): Promise<string>;
    /**
     * Get replay status
     */
    getReplayStatus(replayName: string): Promise<ReplayStatus>;
    /**
     * Cancel an ongoing replay
     */
    cancelReplay(replayName: string): Promise<void>;
    /**
     * List all replays
     */
    listReplays(state?: ReplayState): Promise<ReplayStatus[]>;
    /**
     * Wait for replay to complete
     */
    waitForReplayCompletion(replayName: string, maxWaitTimeMs?: number, // 5 minutes default
    pollIntervalMs?: number): Promise<ReplayStatus>;
}
export declare function getEventReplay(): EventReplay;
//# sourceMappingURL=replay.d.ts.map