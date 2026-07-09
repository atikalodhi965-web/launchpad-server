import { Knex } from 'knex';
import knex from '../db/knex';

export interface CreateCommentParams {
  coinId: string;
  userId: string;
  text: string;
  parentId?: string;
}

export interface GetCommentsParams {
  coinId: string;
  userId?: string; // Optional: to check if the current user has liked the comments
  limit?: number;
  offset?: number;
}

export async function createComment(params: CreateCommentParams) {
  const { coinId, userId, text, parentId } = params;

  if (!coinId || !userId || !text) {
    throw new Error('Missing required fields: coinId, userId, and text are required');
  }

  const [comment] = await knex('coin_comments')
    .insert({
      coin_id: coinId,
      user_id: userId,
      commented_text: text,
      parent_id: parentId || null,
      likes_count: 0,
      replies_count: 0
    })
    .returning('*');

  return {
    success: true,
    data: comment
  };
}

export async function getComments(params: GetCommentsParams) {
  const { coinId, userId, limit = 50, offset = 0 } = params;

  if (!coinId) {
    throw new Error('coinId is required');
  }

  const query = knex('coin_comments as cc')
    .leftJoin('users as u', 'cc.user_id', 'u.id')
    .select(
      'cc.*',
      'u.username',
      'u.profile_image_url',
      knex.raw('(SELECT address FROM wallets WHERE user_id = u.id ORDER BY is_primary DESC, id ASC LIMIT 1) as wallet_address')
    )
    .where('cc.coin_id', coinId)
    .whereNull('cc.parent_id') // Get main comments first
    .orderBy('cc.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  // If userId is provided, check if they liked it
  if (userId) {
    query.select(
      knex.raw("EXISTS(SELECT 1 FROM comment_interactions WHERE comment_id = cc.id AND user_id = ? AND type = 'like') as is_liked", [userId])
    );
  }

  const comments = await query;

  return {
    success: true,
    data: comments
  };
}

export async function getReplies(commentId: string, userId?: string) {
  const query = knex('coin_comments as cc')
    .leftJoin('users as u', 'cc.user_id', 'u.id')
    .select(
      'cc.*',
      'u.username',
      'u.profile_image_url',
      knex.raw('(SELECT address FROM wallets WHERE user_id = u.id ORDER BY is_primary DESC, id ASC LIMIT 1) as wallet_address')
    )
    .where('cc.parent_id', commentId)
    .orderBy('cc.created_at', 'asc');

  if (userId) {
    query.select(
      knex.raw("EXISTS(SELECT 1 FROM comment_interactions WHERE comment_id = cc.id AND user_id = ? AND type = 'like') as is_liked", [userId])
    );
  }

  const replies = await query;

  return {
    success: true,
    data: replies
  };
}

export async function toggleLike(commentId: string, userId: string) {
  const existing = await knex('comment_interactions')
    .where({ comment_id: commentId, user_id: userId, type: 'like' })
    .first();

  const trx = await knex.transaction();

  try {
    if (existing) {
      // Unlike
      await trx('comment_interactions')
        .where({ id: existing.id })
        .delete();

      await trx('coin_comments')
        .where({ id: commentId })
        .decrement('likes_count', 1);

      await trx.commit();
      return { success: true, liked: false };
    } else {
      // Like
      await trx('comment_interactions').insert({
        comment_id: commentId,
        user_id: userId,
        type: 'like'
      });

      await trx('coin_comments')
        .where({ id: commentId })
        .increment('likes_count', 1);

      await trx.commit();
      return { success: true, liked: true };
    }
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
