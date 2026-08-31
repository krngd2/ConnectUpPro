#!/usr/bin/env node

/**
 * Video Timeout Monitor CLI
 * 
 * This script helps debug and manage stuck video analysis processes.
 * Run this manually or via cron job for production monitoring.
 * 
 * Usage:
 *   node scripts/video-timeout-monitor.js [action]
 * 
 * Actions:
 *   check    - Check for stuck videos (default)
 *   process  - Mark stuck videos as FAILED
 *   stats    - Show processing statistics
 *   reset    - Reset a specific video for retry
 * 
 * Examples:
 *   node scripts/video-timeout-monitor.js check
 *   node scripts/video-timeout-monitor.js process
 *   node scripts/video-timeout-monitor.js reset video_id_here
 */

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

// Timeout thresholds (in minutes)
const TIMEOUT_THRESHOLDS = {
  PENDING: 60,
  FETCHING_DETAILS: 10,
  DOWNLOADING_COMMENTS: 120,
  ANALYZING_COMMENTS: 180
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function findStuckVideos() {
  logInfo('Checking for stuck videos...');

  const processingVideos = await prisma.video.findMany({
    where: {
      status: {
        in: ['PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS']
      }
    },
    select: {
      id: true,
      url: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      userId: true
    }
  });

  logInfo(`Found ${processingVideos.length} videos in processing states`);

  const stuckVideos = [];
  const now = new Date();

  for (const video of processingVideos) {
    const minutesSinceUpdate = Math.floor(
      (now.getTime() - video.updatedAt.getTime()) / (1000 * 60)
    );

    const threshold = TIMEOUT_THRESHOLDS[video.status];
    
    if (threshold && minutesSinceUpdate > threshold) {
      stuckVideos.push({
        ...video,
        minutesStuck: minutesSinceUpdate,
        threshold
      });
    }
  }

  return { stuckVideos, processingVideos };
}

async function checkStuckVideos() {
  const { stuckVideos, processingVideos } = await findStuckVideos();

  if (stuckVideos.length === 0) {
    logSuccess('No stuck videos found');
  } else {
    logWarning(`Found ${stuckVideos.length} stuck videos:`);
    
    stuckVideos.forEach(video => {
      console.log(`\n  ${colors.bold}${video.title || video.url}${colors.reset}`);
      console.log(`  ID: ${video.id}`);
      console.log(`  Status: ${colors.yellow}${video.status}${colors.reset}`);
      console.log(`  Stuck for: ${colors.red}${video.minutesStuck} minutes${colors.reset} (threshold: ${video.threshold})`);
      console.log(`  Last updated: ${video.updatedAt.toISOString()}`);
    });
  }

  // Show summary of all processing videos
  const statusCounts = processingVideos.reduce((acc, video) => {
    acc[video.status] = (acc[video.status] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n${colors.bold}Processing Summary:${colors.reset}`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  return stuckVideos;
}

async function processStuckVideos() {
  const { stuckVideos } = await findStuckVideos();

  if (stuckVideos.length === 0) {
    logInfo('No stuck videos to process');
    return { processed: 0, failed: 0 };
  }

  logInfo(`Processing ${stuckVideos.length} stuck videos...`);

  let processed = 0;
  let failed = 0;

  for (const video of stuckVideos) {
    try {
      const reason = `Video stuck in ${video.status} status for ${video.minutesStuck} minutes (threshold: ${video.threshold} minutes)`;
      
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'FAILED',
          updatedAt: new Date(),
          analysisSummary: {
            error: reason,
            failedAt: new Date().toISOString(),
            originalStatus: video.status,
            minutesStuck: video.minutesStuck,
            failureReason: 'timeout',
            autoFailedByScript: true
          }
        }
      });

      logSuccess(`Marked as FAILED: ${video.title || video.url}`);
      processed++;
      
    } catch (error) {
      logError(`Failed to process ${video.id}: ${error.message}`);
      failed++;
    }
  }

  logInfo(`Processing complete: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

async function getStats() {
  logInfo('Gathering video processing statistics...');

  const statusCounts = await prisma.video.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });

  const processingVideos = await prisma.video.findMany({
    where: {
      status: {
        in: ['PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS']
      }
    },
    select: {
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  console.log(`\n${colors.bold}Video Status Breakdown:${colors.reset}`);
  statusCounts.forEach(group => {
    console.log(`  ${group.status}: ${group._count.id}`);
  });

  if (processingVideos.length > 0) {
    const now = new Date();
    const processingTimes = processingVideos.map(video => 
      Math.floor((now.getTime() - video.updatedAt.getTime()) / (1000 * 60))
    );

    const avgTime = Math.floor(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length);
    const maxTime = Math.max(...processingTimes);

    console.log(`\n${colors.bold}Processing Times:${colors.reset}`);
    console.log(`  Average: ${avgTime} minutes`);
    console.log(`  Longest: ${maxTime} minutes`);

    // Check for potentially stuck videos
    const potentiallyStuck = processingVideos.filter(video => {
      const minutesSinceUpdate = Math.floor(
        (now.getTime() - video.updatedAt.getTime()) / (1000 * 60)
      );
      const threshold = TIMEOUT_THRESHOLDS[video.status];
      return threshold && minutesSinceUpdate > (threshold * 0.7);
    }).length;

    if (potentiallyStuck > 0) {
      logWarning(`${potentiallyStuck} videos approaching timeout thresholds`);
    }
  }
}

async function resetVideo(videoId) {
  if (!videoId) {
    logError('Video ID is required for reset action');
    process.exit(1);
  }

  logInfo(`Resetting video ${videoId}...`);

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { status: true, title: true, url: true }
  });

  if (!video) {
    logError(`Video ${videoId} not found`);
    process.exit(1);
  }

  if (video.status !== 'FAILED') {
    logError(`Video is not in FAILED status (current: ${video.status})`);
    process.exit(1);
  }

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'PENDING',
      updatedAt: new Date()
    }
  });

  logSuccess(`Video reset to PENDING: ${video.title || video.url}`);
}

async function main() {
  const action = process.argv[2] || 'check';
  const videoId = process.argv[3];

  try {
    console.log(`${colors.bold}Video Timeout Monitor${colors.reset}\n`);

    switch (action) {
      case 'check':
        await checkStuckVideos();
        break;
      
      case 'process':
        await processStuckVideos();
        break;
      
      case 'stats':
        await getStats();
        break;
      
      case 'reset':
        await resetVideo(videoId);
        break;
      
      default:
        logError(`Unknown action: ${action}`);
        console.log('\nUsage: node scripts/video-timeout-monitor.js [action] [videoId]');
        console.log('Actions: check, process, stats, reset');
        process.exit(1);
    }

  } catch (error) {
    logError(`Script error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  findStuckVideos,
  checkStuckVideos,
  processStuckVideos,
  getStats,
  resetVideo
};
