import { Router } from 'express';
import * as userProfileController from '../../controllers/userProfileController';
import { authenticate } from '../../middlewares/auth';

const userProfileRouter = Router();

// Get current user profile (using token)
userProfileRouter.get('/profile/me', authenticate, userProfileController.getMyProfile);

// Fetch user bio data (public or private)
userProfileRouter.get('/profile/:userId', userProfileController.getUserProfile);

// Fetch coins held data
userProfileRouter.get('/coins-held/:userId', userProfileController.getCoinsHeld);

// Update coins held data
userProfileRouter.post('/coins-held/update', authenticate, userProfileController.updateCoinsHeld);

// Fetch creator earnings data
userProfileRouter.get('/creator-earnings/:userId', userProfileController.getCreatorEarnings);

// Update profile data
userProfileRouter.post('/profile/update', authenticate, userProfileController.updateProfile);

// Follow/Unfollow
userProfileRouter.post('/follow', authenticate, userProfileController.followUser);
userProfileRouter.post('/unfollow', authenticate, userProfileController.unfollowUser);

// Get followers/following lists
userProfileRouter.get('/followers/:userId', userProfileController.getFollowers);
userProfileRouter.get('/following/:userId', userProfileController.getFollowing);

export default userProfileRouter;
