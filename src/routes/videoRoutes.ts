import { Router } from 'express';
import { 
  getUploadPresignedUrl, 
  finalizeVideoUpload, 
  getVideoFeed,
  getTrendingVideos, 
  getVideoDetails, 
  interactWithVideo,
  getVideosByCoin
} from '../controllers/videoController';
 
const videoRouter = Router();

// Get pre-signed URL for browser upload to R2
videoRouter.get('/upload-url', getUploadPresignedUrl);

// Notify server that R2 upload is complete to start pipeline
videoRouter.post('/finalize', finalizeVideoUpload);

// Get trending videos based on algorithm
videoRouter.get('/trending', getTrendingVideos);

// Get video feed (only approved videos)
videoRouter.get('/feed', getVideoFeed);

// Get videos for a specific coin
videoRouter.get('/coin/:coinId', getVideosByCoin);

// Get video details
videoRouter.get('/:id', getVideoDetails);

// Handle video interactions (like, comment, share)
videoRouter.post('/:id/interact', interactWithVideo);

export default videoRouter;