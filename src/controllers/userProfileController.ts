import { Request, Response, RequestHandler } from 'express';
import knex from '../db/knex';

export const getUserProfile: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const user = await knex('users')
      .leftJoin('wallets', function() {
        this.on('users.id', '=', 'wallets.user_id')
          .andOn('wallets.is_primary', '=', knex.raw('?', [true]));
      })
      .where({ 'users.id': userId })
      .select(
        'users.*',
        'wallets.address as wallet_address'
      )
      .first();

    if (!user) {
       res.status(404).json({ success: false, error: 'User not found' });
       return;
    }

    // Return profile data
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        bio: user.bio,
        profile_image_url: user.profile_image_url,
        website: user.website,
        wallet_address: user.wallet_address,
        joined_date: user.joined_date,
        followers_count: user.followers_count,
        following_count: user.following_count,
        referral_code: user.referral_code,
      },
    });
    return;
  } catch (error: any) {
    console.error('[getUserProfile error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const getMyProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    
    const user = await knex('users')
      .leftJoin('wallets', function() {
        this.on('users.id', '=', 'wallets.user_id')
          .andOn('wallets.is_primary', '=', knex.raw('?', [true]));
      })
      .where({ 'users.id': userId })
      .select(
        'users.*',
        'wallets.address as wallet_address'
      )
      .first();

    if (!user) {
       res.status(404).json({ success: false, error: 'User not found' });
       return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
        fullname: user.fullname,
        bio: user.bio,
        profile_image_url: user.profile_image_url,
        website: user.website,
        wallet_address: user.wallet_address,
        joined_date: user.joined_date,
        followers_count: user.followers_count,
        following_count: user.following_count,
        referral_code: user.referral_code,
      },
    });
    return;
  } catch (error: any) {
    console.error('[getMyProfile error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

////////////////////////////////////////
// correct them when writing apis for swap buy sell
export const getCoinsHeld: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const coinsHeld = await knex('user_coins')
      .join('coins', 'user_coins.coin_id', 'coins.id')
      .where({ 'user_coins.user_id': userId })
      .select(
        'coins.id',
        'coins.name',
        'coins.symbol',
        'coins.logo_url',
        'coins.current_price',
        'coins.market_cap',
        'coins.price_change_24h',
        'user_coins.tokens_held',
        'user_coins.avg_buy_price',
        'user_coins.realized_pnl'
      );

    const formattedCoins = coinsHeld.map((coin: any) => {
      const tokensHeld = parseFloat(coin.tokens_held || 0);
      const avgBuyPrice = parseFloat(coin.avg_buy_price || 0);
      const currentPrice = parseFloat(coin.current_price || 0);
      
      const totalCost = tokensHeld * avgBuyPrice;
      const currentValue = tokensHeld * currentPrice;
      const unrealizedPnl = currentValue - totalCost;
      
      // Calculate PnL percentage (unrealized)
      const pnlPercentage = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

      return {
        ...coin,
        tokens_held: tokensHeld,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        unrealized_pnl: unrealizedPnl,
        pnl_percentage: pnlPercentage,
        realized_pnl: parseFloat(coin.realized_pnl || 0)
      };
    });

    res.json({
      success: true,
      data: formattedCoins,
    });
    return;
  } catch (error: any) {
    console.error('[getCoinsHeld error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};
export const updateCoinsHeld: RequestHandler = async (req, res) => {
  try {
    const { userId, coinId, tokens_held, avg_buy_price } = req.body;

    if (!userId || !coinId || tokens_held === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, coinId, tokens_held',
      });
    }

    // Upsert logic: insert new or update existing record for this user and coin
    await knex('user_coins')
      .insert({
        user_id: userId,
        coin_id: coinId,
        tokens_held: tokens_held,
        avg_buy_price: avg_buy_price || 0,
        updated_at: new Date(),
      })
      .onConflict(['user_id', 'coin_id'])
      .merge({
        tokens_held: tokens_held,
        avg_buy_price: avg_buy_price !== undefined ? avg_buy_price : knex.raw('avg_buy_price'),
        updated_at: new Date(),
      });

    res.json({
      success: true,
      message: 'Coins held updated successfully',
    });
    return;
  } catch (error: any) {
    console.error('[updateCoinsHeld error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};
// ////////////////////////////////////////////

export const getCreatorEarnings: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const earnings = await knex('creator_earnings')
      .join('coins', 'creator_earnings.coin_id', 'coins.id')
      .where({ 'creator_earnings.creator_id': userId })
      .select(
        'coins.*',
        'coins.id as coin_id',
        'creator_earnings.total_earned',
        'creator_earnings.total_claimed',
        'creator_earnings.unclaimed'
      );

    res.json({
      success: true,
      data: earnings,
    });
    return;
  } catch (error: any) {
    console.error('[getCreatorEarnings error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const updateProfile: RequestHandler = async (req, res) => {
  try {
    const { userId: bodyUserId, username, fullname, bio, profile_image_url, website } = req.body;
    const authUserId = (req as any).user.userId;

    // Ensure user is only updating their own profile
    const userId = bodyUserId || authUserId;
    if (userId !== authUserId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to update this profile' });
    }

    // Prepare update object
    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (fullname !== undefined) updateData.fullname = fullname;
    if (bio !== undefined) updateData.bio = bio;
    if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;
    if (website !== undefined) updateData.website = website;

    const [updatedUser] = await knex('users')
      .where({ id: userId })
      .update(updateData)
      .returning('*');

    if (!updatedUser) {
       res.status(404).json({ success: false, error: 'User not found' });
       return;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...updatedUser,
        referral_code: updatedUser.referral_code
      },
    });
    return;
  } catch (error: any) {
    console.error('[updateProfile error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};



export const followUser: RequestHandler = async (req, res) => {
  try {
    const { followingId } = req.body;
    const followerId = (req as any).user.userId;

    if (!followerId || !followingId) {
      return res.status(400).json({ success: false, error: 'Missing followingId' });
    }

    if (followerId === followingId) {
      return res.status(400).json({ success: false, error: 'Users cannot follow themselves' });
    }

    await knex.transaction(async (trx) => {
      // 1. Check if already following
      const existing = await trx('followers')
        .where({ follower_id: followerId, following_id: followingId })
        .first();

      if (existing) return;

      // 2. Insert follower record
      await trx('followers').insert({
        id: knex.raw('gen_random_uuid()'),
        follower_id: followerId,
        following_id: followingId,
      });

      // 3. Update counts
      await trx('users').where({ id: followingId }).increment('followers_count', 1);
      await trx('users').where({ id: followerId }).increment('following_count', 1);
    });

    res.json({ success: true, message: 'User followed successfully' });
    return;
  } catch (error: any) {
    console.error('[followUser error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const unfollowUser: RequestHandler = async (req, res) => {
  try {
    const { followingId } = req.body;
    const followerId = (req as any).user.userId;

    if (!followerId || !followingId) {
      return res.status(400).json({ success: false, error: 'Missing followingId' });
    }

    await knex.transaction(async (trx) => {
      // 1. Check if following
      const existing = await trx('followers')
        .where({ follower_id: followerId, following_id: followingId })
        .first();

      if (!existing) return;

      // 2. Delete follower record
      await trx('followers')
        .where({ follower_id: followerId, following_id: followingId })
        .del();

      // 3. Update counts
      await trx('users').where({ id: followingId }).decrement('followers_count', 1);
      await trx('users').where({ id: followerId }).decrement('following_count', 1);
    });

    res.json({ success: true, message: 'User unfollowed successfully' });
    return;
  } catch (error: any) {
    console.error('[unfollowUser error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const getFollowers: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const followers = await knex('followers')
      .join('users', 'followers.follower_id', 'users.id')
      .where({ 'followers.following_id': userId })
      .select('users.id', 'users.username', 'users.fullname', 'users.profile_image_url', 'users.bio');

    res.json({ success: true, data: followers });
    return;
  } catch (error: any) {
    console.error('[getFollowers error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const getFollowing: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    const following = await knex('followers')
      .join('users', 'followers.following_id', 'users.id')
      .where({ 'followers.follower_id': userId })
      .select('users.id', 'users.username', 'users.fullname', 'users.profile_image_url', 'users.bio');

    res.json({ success: true, data: following });
    return;
  } catch (error: any) {
    console.error('[getFollowing error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};
