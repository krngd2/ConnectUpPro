-- PostgreSQL setup for video timeout monitoring using pg_cron
-- This script sets up automatic monitoring for stuck video analysis processes

-- Enable the pg_cron extension (requires superuser or equivalent privileges)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to mark stuck videos as failed
CREATE OR REPLACE FUNCTION mark_stuck_videos_as_failed()
RETURNS TABLE (
    video_id UUID,
    original_status TEXT,
    minutes_stuck INTEGER,
    action_taken TEXT
) AS $$
DECLARE
    stuck_video RECORD;
    timeout_thresholds CONSTANT JSONB := '{
        "PENDING": 60,
        "FETCHING_DETAILS": 10,
        "DOWNLOADING_COMMENTS": 120,
        "ANALYZING_COMMENTS": 180
    }';
    threshold_minutes INTEGER;
    minutes_since_update INTEGER;
BEGIN
    -- Log the start of the timeout check
    RAISE NOTICE 'Starting video timeout check at %', NOW();

    -- Loop through videos in processing states
    FOR stuck_video IN 
        SELECT 
            "id",
            "url",
            "title",
            "status",
            "createdAt",
            "updatedAt",
            "userId",
            "analysisSummary"
        FROM "Video"
        WHERE "status" IN ('PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS')
    LOOP
        -- Calculate minutes since last update
        minutes_since_update := EXTRACT(EPOCH FROM (NOW() - stuck_video."updatedAt")) / 60;
        
        -- Get timeout threshold for this status
        threshold_minutes := (timeout_thresholds ->> stuck_video."status")::INTEGER;
        
        -- Check if video is stuck (exceeded timeout threshold)
        IF minutes_since_update > threshold_minutes THEN
            RAISE NOTICE 'Found stuck video: % (%) - %min > %min threshold', 
                stuck_video."id", stuck_video."status", minutes_since_update, threshold_minutes;
            
            -- Update the video to FAILED status with timeout details
            UPDATE "Video" 
            SET 
                "status" = 'FAILED',
                "updatedAt" = NOW(),
                "analysisSummary" = COALESCE("analysisSummary", '{}'::jsonb) || jsonb_build_object(
                    'error', format('Video stuck in %s status for %s minutes (threshold: %s minutes)', 
                                   stuck_video."status", minutes_since_update, threshold_minutes),
                    'failedAt', NOW()::text,
                    'originalStatus', stuck_video."status",
                    'minutesStuck', minutes_since_update,
                    'failureReason', 'timeout',
                    'timeoutDetails', jsonb_build_object(
                        'originalStatus', stuck_video."status",
                        'minutesStuck', minutes_since_update,
                        'checkedAt', NOW()::text,
                        'autoFailedByPgCron', true,
                        'thresholdMinutes', threshold_minutes
                    )
                )
            WHERE "id" = stuck_video."id";
            
            -- Return information about what was processed
            video_id := stuck_video."id";
            original_status := stuck_video."status";
            minutes_stuck := minutes_since_update;
            action_taken := 'MARKED_AS_FAILED';
            
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed video timeout check at %', NOW();
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to get video processing statistics
CREATE OR REPLACE FUNCTION get_video_processing_stats()
RETURNS TABLE (
    status_name TEXT,
    video_count BIGINT,
    avg_processing_minutes NUMERIC,
    max_processing_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        "status" as status_name,
        COUNT(*) as video_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 60), 2) as avg_processing_minutes,
        ROUND(MAX(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 60), 2) as max_processing_minutes
    FROM "Video"
    WHERE "status" IN ('PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS', 'COMPLETED', 'FAILED')
    GROUP BY "status"
    ORDER BY 
        CASE "status"
            WHEN 'PENDING' THEN 1
            WHEN 'FETCHING_DETAILS' THEN 2
            WHEN 'DOWNLOADING_COMMENTS' THEN 3
            WHEN 'ANALYZING_COMMENTS' THEN 4
            WHEN 'COMPLETED' THEN 5
            WHEN 'FAILED' THEN 6
            ELSE 7
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to log video timeout monitoring activity
CREATE OR REPLACE FUNCTION log_video_timeout_check()
RETURNS VOID AS $$
DECLARE
    stuck_count INTEGER;
    processing_count INTEGER;
BEGIN
    -- Count stuck videos
    SELECT COUNT(*) INTO stuck_count
    FROM "Video" v
    WHERE v."status" IN ('PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS')
    AND (
        (v."status" = 'PENDING' AND EXTRACT(EPOCH FROM (NOW() - v."updatedAt")) / 60 > 60) OR
        (v."status" = 'FETCHING_DETAILS' AND EXTRACT(EPOCH FROM (NOW() - v."updatedAt")) / 60 > 10) OR
        (v."status" = 'DOWNLOADING_COMMENTS' AND EXTRACT(EPOCH FROM (NOW() - v."updatedAt")) / 60 > 120) OR
        (v."status" = 'ANALYZING_COMMENTS' AND EXTRACT(EPOCH FROM (NOW() - v."updatedAt")) / 60 > 180)
    );
    
    -- Count total processing videos
    SELECT COUNT(*) INTO processing_count
    FROM "Video"
    WHERE "status" IN ('PENDING', 'FETCHING_DETAILS', 'DOWNLOADING_COMMENTS', 'ANALYZING_COMMENTS');
    
    -- Log the check (you can insert this into a monitoring table if needed)
    RAISE NOTICE 'Video timeout check completed: % stuck videos out of % processing videos at %', 
        stuck_count, processing_count, NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule the timeout monitoring job to run every 30 minutes
-- Uncomment the following line after enabling pg_cron extension:
-- SELECT cron.schedule('video-timeout-monitor', '*/30 * * * *', 'SELECT mark_stuck_videos_as_failed();');

-- Schedule a stats logging job to run every hour
-- Uncomment the following line after enabling pg_cron extension:
-- SELECT cron.schedule('video-stats-logger', '0 * * * *', 'SELECT log_video_timeout_check();');

-- Manual execution examples:
-- To manually check for stuck videos:
-- SELECT * FROM mark_stuck_videos_as_failed();

-- To get current processing stats:
-- SELECT * FROM get_video_processing_stats();

-- To view scheduled jobs (after setting up pg_cron):
-- SELECT * FROM cron.job;

-- To remove a scheduled job:
-- SELECT cron.unschedule('video-timeout-monitor');

/*
SETUP INSTRUCTIONS:

1. Enable pg_cron extension (requires superuser privileges):
   CREATE EXTENSION IF NOT EXISTS pg_cron;

2. Uncomment the cron.schedule lines above to enable automatic monitoring

3. Verify the jobs are scheduled:
   SELECT * FROM cron.job;

4. Monitor the PostgreSQL logs for timeout check messages

5. Optional: Create a monitoring table to store timeout check results:
   
   CREATE TABLE video_timeout_logs (
       id SERIAL PRIMARY KEY,
       check_time TIMESTAMP DEFAULT NOW(),
       stuck_videos_found INTEGER,
       processing_videos_total INTEGER,
       videos_marked_failed INTEGER,
       details JSONB
   );

TIMEOUT THRESHOLDS:
- PENDING: 60 minutes (1 hour)
- FETCHING_DETAILS: 10 minutes
- DOWNLOADING_COMMENTS: 120 minutes (2 hours)
- ANALYZING_COMMENTS: 180 minutes (3 hours)

The monitoring runs every 30 minutes and automatically marks stuck videos as FAILED.
*/
