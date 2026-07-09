import { Router } from 'express';
import * as socialAuthController from '../../controllers/socialAuthController';

const socialAuthRouter = Router();

// Twitter OAuth
socialAuthRouter.get('/twitter', socialAuthController.initiateTwitterAuth);
socialAuthRouter.get('/twitter/callback', socialAuthController.twitterCallback);

// TikTok OAuth
socialAuthRouter.get('/tiktok', socialAuthController.initiateTikTokAuth);
socialAuthRouter.get('/tiktok/callback', socialAuthController.tiktokCallback);

// Get user verifications
socialAuthRouter.get('/verifications/:userId', socialAuthController.getSocialVerifications);

export default socialAuthRouter;
