import { Request, Response } from 'express';
import knex from '../db/knex';
import { v4 as uuidv4 } from 'uuid';
import { getUploadUrl, getR2PublicUrl } from '../utils/s3';
import { addVideoToPipeline } from '../redis/videoQueue';

/**
 * Get pre-signed URL for uploading video to R2
 */
export async function getUploadPresignedUrl(req: Request, res: Response): Promise<void> {
  try {
    const { fileType, contentType } = req.query as { fileType?: string, contentType?: string };
    const type = fileType || contentType;

    if (!type) {
      res.status(400).json({ success: false, error: 'fileType or contentType is required' });
      return;
    }

    const { url, key } = await getUploadUrl(type);
    const publicUrl = getR2PublicUrl(key);
    console.log("publicUrl", publicUrl);

    res.json({
      success: true,
      uploadUrl: url,
      fileId: key,
      publicUrl
    });
  } catch (err: any) {
    console.error('[getUploadPresignedUrl] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate upload URL', err: err.message });
  }
}

/**
 * Finalize R2 upload and trigger processing pipeline
 */
export async function finalizeVideoUpload(req: Request, res: Response): Promise<void> {
  try {
    const { tokenMint, r2Key, title, description, userId } = req.body;

    if (!userId || !tokenMint || !r2Key) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Resolve user (id to id)
    const user = await knex('users').where({ id: userId }).first();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const videoId = uuidv4();
    const videoData = {
      id: videoId,
      coin_id: tokenMint,
      creator_id: user.id,
      r2_key: r2Key,
      video_url: getR2PublicUrl(r2Key), // Store public URL instead of empty string
      thumbnail_url: req.body.thumbnailUrl || null,
      status: 'pending',
      caption: title || description || '',
    };

    await knex('coin_videos').insert(videoData);

    // Trigger BullMQ pipeline
    await addVideoToPipeline(videoId, r2Key);

    res.json({
      success: true,
      videoId,
      message: 'Video upload finalized and processing started',
    });
  } catch (err: any) {
    console.error('[finalizeVideoUpload] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to finalize video upload' });
  }
}

// Get video feed (only approved videos)
export async function getVideoFeed(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const videos = await knex('coin_videos')
      .select(
        'coin_videos.*',
        'coins.name as token_name',
        'coins.symbol as token_symbol',
        'coins.logo_url as token_image',
        'users.username',
        'users.profile_image_url'
      )
      .join('coins', 'coin_videos.coin_id', 'coins.id')
      .join('users', 'coin_videos.creator_id', 'users.id')
      .where('coin_videos.is_approved', true) // Only approved
      .orderBy('coin_videos.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      videos,
      hasMore: videos.length === limit,
    });
  } catch (err: any) {
    console.error('[getVideoFeed] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load video feed' });
  }
}

/**
 * Get trending videos based on weighted score:
 * (views * 0.4) + (likes * 0.3) + (volume_24h * 0.2) + (price_change_24h * 0.1)
 */
export async function getTrendingVideos(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const videos = await knex('coin_videos')
      .select(
        'coin_videos.*',
        'coins.name as token_name',
        'coins.symbol as token_symbol',
        'coins.logo_url as token_image',
        'coins.market_cap',
        'coins.bonding_progress',
        'coins.price_change_24h',
        'coins.volume_24h',
        'users.username',
        'users.profile_image_url'
      )
      .join('coins', 'coin_videos.coin_id', 'coins.id')
      .join('users', 'coin_videos.creator_id', 'users.id')
      .where('coin_videos.is_approved', true)
      .orderByRaw(`(COALESCE(coin_videos.views_count, 0) * 0.4) + (COALESCE(coin_videos.likes_count, 0) * 0.3) + (COALESCE(coins.volume_24h, 0) * 0.2) + (COALESCE(coins.price_change_24h, 0) * 0.1) DESC`)
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      videos,
      hasMore: videos.length === limit,
    });
  } catch (err: any) {
    console.error('[getTrendingVideos] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load trending videos' });
  }
}

// Get video details
export async function getVideoDetails(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const video = await knex('coin_videos')
      .select(
        'coin_videos.*',
        'coins.name as token_name',
        'coins.symbol as token_symbol',
        'coins.logo_url as token_image',
        'users.username',
        'users.profile_image_url'
      )
      .join('coins', 'coin_videos.coin_id', 'coins.id')
      .join('users', 'coin_videos.creator_id', 'users.id')
      .where('coin_videos.id', id)
      .first();

    if (!video) {
      res.status(404).json({ success: false, error: 'Video not found' });
      return;
    }

    res.json({ success: true, video });
  } catch (err: any) {
    console.error('[getVideoDetails] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load video details' });
  }
}

// Interact with video
export async function interactWithVideo(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { action, userId } = req.body; // action: 'like', 'share', 'view'

    if (!['like', 'share', 'view'].includes(action)) {
      res.status(400).json({ success: false, error: 'Invalid interaction action' });
      return;
    }

    if (action === 'like' && userId) {
      // Toggle like logic
      const existingLike = await knex('video_interactions')
        .where({ video_id: id, user_id: userId, type: 'like' })
        .first();

      if (existingLike) {
        // Unlike
        await knex('video_interactions')
          .where({ video_id: id, user_id: userId, type: 'like' })
          .delete();
        
        await knex('coin_videos')
          .where({ id })
          .decrement('likes_count', 1);
        
        res.json({ success: true, message: 'unliked', liked: false });
        return;
      } else {
        // Like
        await knex('video_interactions').insert({
          video_id: id,
          user_id: userId,
          type: 'like'
        });
        
        await knex('coin_videos')
          .where({ id })
          .increment('likes_count', 1);

        res.json({ success: true, message: 'liked', liked: true });
        return;
      }
    }

    const column = action === 'like' ? 'likes_count' : action === 'share' ? 'shares_count' : 'views_count';
    
    await knex('coin_videos')
      .where({ id })
      .increment(column, 1);

    // For non-like interactions (view/share), we just record it if userId exists
    if (userId) {
      await knex('video_interactions').insert({
        video_id: id,
        user_id: userId,
        type: action === 'view' ? 'view' : action === 'share' ? 'share' : 'view'
      }).onConflict(['video_id', 'user_id', 'type']).ignore();
    }

    res.json({ success: true, message: `Video ${action} recorded` });
  } catch (err: any) {
    console.error('[interactWithVideo] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to record interaction' });
  }
}

/**
 * Get all videos for a specific coin
 */
export async function getVideosByCoin(req: Request, res: Response): Promise<void> {
  try {
    const { coinId } = req.params;
    const { userId } = req.query as { userId?: string };
    console.log(`[getVideosByCoin] coinId: ${coinId}, userId: ${userId}`);

    let query = knex('coin_videos')
      .select(
        'coin_videos.*',
        'users.username',
        'users.profile_image_url'
      )
      .join('users', 'coin_videos.creator_id', 'users.id')
      .where('coin_videos.coin_id', coinId)
      .andWhere('coin_videos.is_approved', true);

    if (userId) {
      query.select(
        knex.raw('EXISTS(SELECT 1 FROM video_interactions WHERE video_id = coin_videos.id AND user_id = ? AND type = \'like\') as is_liked', [userId])
      );
    }

    const videos = await query
      .orderBy('coin_videos.is_pinned', 'desc')
      .orderBy('coin_videos.created_at', 'desc');

    res.json({ success: true, videos });
  } catch (err: any) {
    console.error('[getVideosByCoin] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load videos for coin' });
  }
}