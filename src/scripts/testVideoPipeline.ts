import knex from '../db/knex';
import { addVideoToPipeline } from '../redis/videoQueue';
import { v4 as uuidv4 } from 'uuid';
import { getR2PublicUrl } from '../utils/s3';
import dotenv from 'dotenv';

dotenv.config();

/**
 * MANUAL TEST SCRIPT
 * This script inserts a dummy record into the database and triggers the BullMQ pipeline.
 * Use this to verify that the videoWorker is picking up jobs and processing them correctly.
 */
async function triggerTest() {
  console.log("--- Video Pipeline Test Trigger ---");

  // PRE-REQUISITE: You must have at least one user and one coin in your DB
  const user = await knex('users').first();
  const coin = await knex('coins').first();

  if (!user || !coin) {
    console.error("❌ Error: You need at least one user and one coin in the database to run this test.");
    process.exit(1);
  }

  const testVideoId = uuidv4();
  const testR2Key = "test-video.mp4"; // Ensure this is a valid key in your R2 bucket if testing real ingestion

  console.log(`Creating test record for Video ID: ${testVideoId}`);
  console.log(`Associated with User: ${user.username} and Coin: ${coin.symbol}`);
  
  try {
    await knex('coin_videos').insert({
      id: testVideoId,
      coin_id: coin.id,
      creator_id: user.id,
      r2_key: testR2Key,
      status: 'pending',
      video_url: getR2PublicUrl(testR2Key)
    });

    // Add to BullMQ queue
    console.log("Adding job to 'video-processing' queue...");
    await addVideoToPipeline(testVideoId, testR2Key);

    console.log("✅ Job added! Now check the output in your 'npm run video-worker' terminal.");
  } catch (err) {
    console.error("❌ Failed to trigger test:", err);
  } finally {
    // Wait a bit for the job to be sent before closing
    setTimeout(() => process.exit(0), 1000);
  }
}

triggerTest();
