import express, { Router, Request, RequestHandler, Response, NextFunction } from 'express';
import axios from 'axios';
import knex from "../../db/knex";
import { finalizeTokenService, finalizeTokenWithBuy, getTokensService, getTokenDetailsService, getTopHoldersService } from '../../services/tokenService';
import { createComment, getComments, toggleLike, getReplies } from '../../services/commentService';
import { redisClient } from '../../redis/redisClient';
const tokenApiRouter = express.Router();


tokenApiRouter.post('/finalize-token', async (req, res) => {
  const result = await finalizeTokenService(knex, req.body);
  res.json(result);
});

tokenApiRouter.post('/finalize-token-with-buy', async (req, res) => {
  const result = await finalizeTokenWithBuy(knex, req.body);
  res.json(result);
});

tokenApiRouter.get('/tokens-list', async (req, res) => {
  const result = await getTokensService(req.query);
  res.json(result);
});

tokenApiRouter.get('/details/:coinId', async (req, res) => {
  const { coinId } = req.params;
  const result = await getTokenDetailsService(coinId);
  res.json(result);
});

tokenApiRouter.get('/holders/:coinId', async (req, res) => {
  const { coinId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const result = await getTopHoldersService(coinId, limit);
  res.json(result);
});

// Comment Routes
tokenApiRouter.post('/coins/:coinId/comments', async (req: any, res: any) => {
  try {
    const { coinId } = req.params;
    const { userId, text, parentId } = req.body;
    const result = await createComment({ coinId, userId, text, parentId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

tokenApiRouter.get('/coins/:coinId/comments', async (req: any, res: any) => {
  try {
    const { coinId } = req.params;
    const { userId, limit, offset } = req.query;
    const result = await getComments({
      coinId,
      userId: userId as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

tokenApiRouter.get('/comments/:commentId/replies', async (req: any, res: any) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.query;
    const result = await getReplies(commentId, userId as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

tokenApiRouter.post('/comments/:commentId/toggle-like', async (req: any, res: any) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;
    const result = await toggleLike(commentId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});



export default tokenApiRouter;


