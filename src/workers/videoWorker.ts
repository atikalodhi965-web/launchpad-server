import { Worker, Job } from 'bullmq';
import knex from '../db/knex';
import { ingestToCloudflareStream, moderateVideo, checkStreamStatus } from '../utils/videoPipeline';
import { getR2PublicUrl } from '../utils/s3';
import Mux from '@mux/mux-node';

const muxClient = new Mux({
  tokenId: process.env.MUX_TOKEN_ID || "00b84d56-00e8-4b4f-8f53-71b45d7adcc8",
  tokenSecret: process.env.MUX_TOKEN_SECRET || "5u/79Oy0UCVczkrGpGEoG6uwHOrZFlL9vM2NpXDBdfPIApElOdBxk5TAwxT4XWW1RNFeeXTF8t6",
});

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(REDIS_URL);
const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  username: url.username,
};

export const videoWorker = new Worker(
  'video-processing',
  async (job: Job) => {
    const { videoId, r2Key } = job.data;
    console.log(`[VideoWorker] Processing job ${job.id} for videoId: ${videoId}`);

    try {
      // 1. Update status to 'processing'
      await knex('coin_videos')
        .where('id', videoId)
        .update({
          status: 'processing',
          processing_started_at: knex.fn.now(),
        });

      // 2. Ingest to Cloudflare Stream
      const r2Url = getR2PublicUrl(r2Key);
      let streamResult: any;
      let streamId: string = '';

      try {
        console.log("running ingestToCloudflareStream with r2Url:", r2Url);
        streamResult = await ingestToCloudflareStream(r2Url);
        streamId = streamResult.uid;
        console.log("Cloudflare Stream Result:", streamResult);
      } catch (cfError) {
        console.error('[VideoWorker] CF Stream failed, falling back to Mux:', cfError);
        // Fallback to Mux
        const asset = await muxClient.video.assets.create({
          inputs: [{ url: r2Url }],
          playback_policy: ['public'],
        });
        streamResult = {
          uid: asset.id,
          thumbnail: `https://image.mux.com/${asset.playback_ids?.[0].id}/thumbnail.jpg`,
          playback: {
            hls: `https://stream.mux.com/${asset.playback_ids?.[0].id}.m3u8`,
          }
        };
        streamId = asset.id;
        
        await knex('coin_videos')
          .where('id', videoId)
          .update({
            mux_asset_id: asset.id,
            mux_playback_id: asset.playback_ids?.[0].id,
          });
      }

      await knex('coin_videos')
        .where('id', videoId)
        .update({
          cloudflare_stream_id: streamId,
        });

      // 3. Status Check / Loop (simplified here, in reality, maybe a separate job for "is it ready?")
      // For now, let's wait a bit or just proceed to moderation if we have a thumbnail URL
      const cfThumbnail = streamResult.thumbnail;
      console.log("Thumbnail URL for moderation:", cfThumbnail);

      // 4. Update status to 'moderating'
      await knex('coin_videos')
        .where('id', videoId)
        .update({
          status: 'moderating',
        });

      // 5. OpenAI Vision Moderation
      const moderation = await moderateVideo(cfThumbnail);

      // 6. Final Status Update
      const isApproved = moderation.approved;

      await knex('coin_videos')
        .where('id', videoId)
        .update({
          status: isApproved ? 'approved' : 'rejected',
          is_approved: isApproved,
          moderation_reason: moderation.reason,
          moderation_metadata: JSON.stringify(moderation),
          video_url: streamResult.playback?.hls || r2Url, // HLS if ready
          thumbnail_url: cfThumbnail,
          processing_completed_at: knex.fn.now(),
        });

      // If approved, update related tables
      if (isApproved) {
          const video = await knex('coin_videos').where('id', videoId).first();
          if (video && video.coin_id) {
              // 1. Sync with coin_media table (used for main token listings)
              await knex('coin_media')
                .where('coin_id', video.coin_id)
                .update({
                  video_url: streamResult.playback?.hls || r2Url,
                  thumbnail_url: cfThumbnail
                });
          }
      }

      console.log(`[VideoWorker] JOB ${job.id} COMPLETED: ${isApproved ? 'Approved' : 'Rejected'}`);
    } catch (error: any) {
      console.error(`[VideoWorker] JOB ${job.id} FAILED:`, error.message);
      await knex('coin_videos')
        .where('id', videoId)
        .update({
          status: 'pending', // Allow retry
          moderation_reason: `Internal Error: ${error.message}`,
        });
      throw error;
    }
  },
  { connection: redisConnection }
);

videoWorker.on('completed', (job) => {
  console.log(`${job.id} has completed!`);
});

videoWorker.on('failed', (job, err) => {
  console.log(`${job?.id} has failed with ${err.message}`);
});
