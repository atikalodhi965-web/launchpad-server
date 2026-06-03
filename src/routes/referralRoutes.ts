import * as referralService from '../services/referralService';
import knex from '../db/knex';
import { Router } from 'express';

const referralRouter = Router();

// Get referral stats for a user
referralRouter.get('/stats/:userId', async (req: any, res: any) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await knex('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const stats = await referralService.getReferralStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get list of friends referred by a user
referralRouter.get('/list/:userId', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const referrals = await referralService.getReferrerReferrals(userId);
    res.json({ success: true, data: referrals });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get referral leaderboard
// Get referral leaderboard
referralRouter.get('/leaderboard', async (req: any, res: any) => {
  try {
    const leaderboard = await referralService.getReferralLeaderboard();
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get earning config/tiers
referralRouter.get('/config', async (req: any, res: any) => {
  try {
    const config = await referralService.getEarningConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Accept a referral code
referralRouter.post('/accept', async (req: any, res: any) => {
  try {
    const { userId, referralCode } = req.body;
    if (!userId || !referralCode) {
      return res.status(400).json({ success: false, error: 'Missing userId or referralCode' });
    }
    const result = await referralService.acceptReferral(userId, referralCode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Skip referral step
referralRouter.post('/skip', async (req: any, res: any) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }
    const result = await referralService.skipReferral(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default referralRouter;
