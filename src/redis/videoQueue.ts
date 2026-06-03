import { Queue } from 'bullmq';
import { redisClient } from './redisClient';

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Redis credentials from URL for BullMQ
const url = new URL(REDIS_URL);
const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  username: url.username,
};

export const videoQueue = new Queue('video-processing', {
  connection: redisConnection,
});

export const addVideoToPipeline = async (videoId: string, r2Key: string) => {
  await videoQueue.add('process-video', { videoId, r2Key }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
};
