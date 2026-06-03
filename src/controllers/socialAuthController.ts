import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import knex from '../db/knex';
import { redisClient } from '../redis/redisClient';

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
console.log('TWITTER_CLIENT_ID:', TWITTER_CLIENT_ID);
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
console.log('TWITTER_CLIENT_SECRET:', TWITTER_CLIENT_SECRET);
const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || 'http://192.168.1.148:8080/api/auth/social/twitter/callback';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || 'http://192.168.1.148:8080/api/auth/social/tiktok/callback';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// PKCE Helpers
const base64URLEncode = (str: Buffer) => {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const sha256 = (buffer: string) => {
  return crypto.createHash('sha256').update(buffer).digest();
};

export const initiateTwitterAuth = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    const state = crypto.randomBytes(16).toString('hex');

    // Store verifier and userId in Redis with 10 min expiry
    await redisClient.set(`twitter_auth:${state}`, JSON.stringify({ userId, codeVerifier }), {
      EX: 600
    });

    const url = new URL('https://twitter.com/i/oauth2/authorize');
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', TWITTER_CLIENT_ID);
    url.searchParams.append('redirect_uri', TWITTER_REDIRECT_URI);
    url.searchParams.append('scope', 'users.read tweet.read');
    url.searchParams.append('state', state);
    url.searchParams.append('code_challenge', codeChallenge);
    url.searchParams.append('code_challenge_method', 'S256');

    res.redirect(url.toString());
  } catch (error) {
    console.error('Twitter Auth Initiation Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const twitterCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'twitter', error: '${error}' }, '*'); window.close();</script>`);
    }

    const storedData = await redisClient.get(`twitter_auth:${state as string}`);
    if (!storedData) {
      return res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'twitter', error: 'Invalid state or session expired' }, '*'); window.close();</script>`);
    }

    const { userId, codeVerifier } = JSON.parse(storedData);

    // Exchange code for token
    const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        client_id: TWITTER_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: TWITTER_REDIRECT_URI,
        code_verifier: codeVerifier
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token } = tokenResponse.data;

    // Fetch profile
    const profileResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id: account_id, username: handle } = profileResponse.data.data;

    // Store in DB
    await knex('user_social_verifications')
      .insert({
        user_id: userId,
        platform: 'twitter',
        handle,
        account_id
      })
      .onConflict(['user_id', 'platform'])
      .merge();

    // Notify frontend and close
    res.send(`<script>window.opener.postMessage({ type: 'social_verify_success', platform: 'twitter', handle: '${handle}' }, '*'); window.close();</script>`);

  } catch (error: any) {
    console.error('Twitter Callback Error:', error.response?.data || error);
    res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'twitter', error: 'Failed to verify Twitter' }, '*'); window.close();</script>`);
  }
};

export const initiateTikTokAuth = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(codeVerifier));

    await redisClient.set(`tiktok_auth:${state}`, JSON.stringify({ userId, codeVerifier }), {
      EX: 600
    });

    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.append('client_key', TIKTOK_CLIENT_KEY);
    url.searchParams.append('scope', 'user.info.basic');
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', TIKTOK_REDIRECT_URI);
    url.searchParams.append('state', state);
    url.searchParams.append('code_challenge', codeChallenge);
    url.searchParams.append('code_challenge_method', 'S256');

    res.redirect(url.toString());
  } catch (error) {
    console.error('TikTok Auth Initiation Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const tiktokCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'tiktok', error: '${error}' }, '*'); window.close();</script>`);
    }

    const storedData = await redisClient.get(`tiktok_auth:${state as string}`);
    if (!storedData) {
      return res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'tiktok', error: 'Invalid state or session expired' }, '*'); window.close();</script>`);
    }

    const { userId, codeVerifier } = JSON.parse(storedData);

    // Exchange code for token
    const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_REDIRECT_URI,
        code_verifier: codeVerifier
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, open_id } = tokenResponse.data;

    // Fetch profile
    const profileResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      headers: { Authorization: `Bearer ${access_token}` },
      params: { fields: 'display_name,username' }
    });

    const { username: handle } = profileResponse.data.data.user;

    // Store in DB
    await knex('user_social_verifications')
      .insert({
        user_id: userId,
        platform: 'tiktok',
        handle,
        account_id: open_id
      })
      .onConflict(['user_id', 'platform'])
      .merge();

    res.send(`<script>window.opener.postMessage({ type: 'social_verify_success', platform: 'tiktok', handle: '${handle}' }, '*'); window.close();</script>`);

  } catch (error: any) {
    console.error('TikTok Callback Error:', error.response?.data || error);
    res.send(`<script>window.opener.postMessage({ type: 'social_verify_error', platform: 'tiktok', error: 'Failed to verify TikTok' }, '*'); window.close();</script>`);
  }
};

export const getSocialVerifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const verifications = await knex('user_social_verifications')
      .where({ user_id: userId })
      .select('platform', 'handle', 'verified_at');

    res.json({ success: true, data: verifications });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch verifications' });
  }
};
