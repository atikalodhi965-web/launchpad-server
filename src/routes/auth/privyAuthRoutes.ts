import express, {Request, Response } from 'express';
// import { Request, Response } from "express";
import jwt from 'jsonwebtoken';
import axios from 'axios';
import  knex  from '../../db/knex';
// import dotenv from "dotenv";
const privyRouter = express.Router();

// Verify Privy token & login
privyRouter.post('/privy-login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { privyToken, wallet } = req.body;
    if (!privyToken || !wallet?.address)
      return res.status(400).json({ error: 'Missing token or wallet' });

    // Verify Privy token
    const response = await axios.get('https://auth.privy.io/api/v1/verify', {
      headers: { Authorization: `Bearer ${privyToken}` },
    });
    const privyUser = response.data;

    // Upsert user
    let user = await knex('users').where({ privy_user_id: privyUser.id }).first();

    if (!user) {
      const [newUser] = await knex('users')
        .insert({
          id: wallet.address,
          username: wallet.address.substring(0, 6),
          handle: wallet.address.substring(0, 6),
          email: privyUser.email,
          privy_user_id: privyUser.id,
        })
        .returning('*');
      user = newUser;
    }

    // Upsert wallet
    const existingWallet = await knex('user_wallets')
      .where({ wallet_address: wallet.address })
      .first();

    if (!existingWallet) {
      await knex('user_wallets').insert({
        user_id: user.id,
        wallet_address: wallet.address,
        provider: wallet.provider || 'privy',
        is_primary: true,
      });
    }

    // Generate local JWT session token
    const sessionToken = jwt.sign(
      { user_id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({ user, sessionToken });
  } catch (err) {
    console.error('Privy login error:', err);
    res.status(500).json({ error: 'Auth failed' });
  }
});

export default privyRouter;
