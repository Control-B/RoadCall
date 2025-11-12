#!/usr/bin/env ts-node

/**
 * Event Replay CLI Tool
 * 
 * Usage:
 *   ts-node replay-events.ts start --archive roadcall-events-archive-dev \
 *     --start "2024-01-01T00:00:00Z" --end "2024-01-01T23:59:59Z" \
 *     --event-bus roadcall-events-dev
 * 
 *   ts-node replay-events.ts status --replay my-replay-name
 * 
 *   ts-node replay-events.ts cancel --replay my-replay-name
 * 
 *   ts-node replay-events.ts list
 */

import { EventReplay } from '@roadcall/events';
import { Command } from 'commander';

const program = new Command();

program
  .name('replay-events')
  .description('CLI tool for replaying EventBridge events from archive')
  .version('1.0.0');

program
  .command('start')
  .description('Start replaying events from archive')
  .requiredOption('--archive <name>', 'Archive name')
  .requiredOption('--start <datetime>', 'Start time (ISO 8601)')
  .requiredOption('--end <datetime>', 'End time (ISO 8601)')
  .requiredOption('--event-bus <arn>', 'Event bus ARN')
  .option('--replay-name <name>', 'Custom replay name')
  .option('--description <text>', 'Replay description')
  .action(async (options) => {
    try {
      const replay = new EventReplay();
      
      const replayName = options.replayName || `replay-${Date.now()}`;
      const startTime = new Date(options.start);
      const endTime = new Date(options.end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.error('Error: Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)');
        process.exit(1);
      }

      if (startTime >= endTime) {
        console.error('Error: Start time must be before end time');
        process.exit(1);
      }

      console.log('Starting replay...');
      console.log(`  Archive: ${options.archive}`);
      console.log(`  Replay Name: ${replayName}`);
      console.log(`  Start Time: ${startTime.toISOString()}`);
      console.log(`  End Time: ${endTime.toISOString()}`);
      console.log(`  Event Bus: ${options.eventBus}`);

      const replayArn = await replay.startReplay({
        archiveName: options.archive,
        replayName,
        eventSourceArn: options.eventBus,
        startTime,
        endTime,
        description: options.description,
      });

      console.log('\n✓ Replay started successfully');
      console.log(`  Replay ARN: ${replayArn}`);
      console.log(`\nCheck status with: replay-events status --replay ${replayName}`);
    } catch (error: any) {
      console.error('Error starting replay:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Get replay status')
  .requiredOption('--replay <name>', 'Replay name')
  .option('--wait', 'Wait for replay to complete')
  .action(async (options) => {
    try {
      const replay = new EventReplay();

      if (options.wait) {
        console.log(`Waiting for replay '${options.replay}' to complete...`);
        const status = await replay.waitForReplayCompletion(options.replay);
        console.log('\n✓ Replay completed');
        console.log(JSON.stringify(status, null, 2));
      } else {
        const status = await replay.getReplayStatus(options.replay);
        console.log('Replay Status:');
        console.log(JSON.stringify(status, null, 2));
      }
    } catch (error: any) {
      console.error('Error getting replay status:', error.message);
      process.exit(1);
    }
  });

program
  .command('cancel')
  .description('Cancel an ongoing replay')
  .requiredOption('--replay <name>', 'Replay name')
  .action(async (options) => {
    try {
      const replay = new EventReplay();

      console.log(`Cancelling replay '${options.replay}'...`);
      await replay.cancelReplay(options.replay);
      console.log('✓ Replay cancelled successfully');
    } catch (error: any) {
      console.error('Error cancelling replay:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all replays')
  .option('--state <state>', 'Filter by state (STARTING, RUNNING, COMPLETED, CANCELLED, FAILED)')
  .action(async (options) => {
    try {
      const replay = new EventReplay();

      const replays = await replay.listReplays(options.state);

      if (replays.length === 0) {
        console.log('No replays found');
        return;
      }

      console.log(`Found ${replays.length} replay(s):\n`);
      replays.forEach((r, index) => {
        console.log(`${index + 1}. ${r.replayName}`);
        console.log(`   State: ${r.state}`);
        if (r.eventStartTime) {
          console.log(`   Event Range: ${r.eventStartTime.toISOString()} - ${r.eventEndTime?.toISOString()}`);
        }
        if (r.replayStartTime) {
          console.log(`   Replay Started: ${r.replayStartTime.toISOString()}`);
        }
        if (r.eventLastReplayedTime) {
          console.log(`   Last Replayed: ${r.eventLastReplayedTime.toISOString()}`);
        }
        console.log('');
      });
    } catch (error: any) {
      console.error('Error listing replays:', error.message);
      process.exit(1);
    }
  });

program.parse();
