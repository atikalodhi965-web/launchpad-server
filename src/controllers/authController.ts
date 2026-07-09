import { Request, Response, RequestHandler } from 'express';
import knex from '../db/knex';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as otpService from '../services/otpService';
import { generateReferralCode } from '../services/referralService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';

export const signup: RequestHandler = async (req, res) => {
  try {
    const { username, email, password, fullname, bio, profile_image_url, website } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ success: false, error: 'Missing username, email, or password' });
      return;
    }

    // Check if user already exists
    const existingUser = await knex('users')
      .where({ username })
      .orWhere({ email })
      .first();

    if (existingUser) {
      res.status(400).json({ success: false, error: 'Username or email already exists' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const newUserPreviewId = uuidv4();

    // Create user
    const [newUser] = await knex('users')
      .insert({
        id: newUserPreviewId,
        username,
        email,
        password_hash,
        fullname: fullname || '',
        bio: bio || '',
        profile_image_url: profile_image_url || '',
        website: website || '',
        joined_date: new Date(),
        referral_code: generateReferralCode(username, newUserPreviewId)
      })
      .returning('*');

    // Create JWT
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullname: newUser.fullname,
        bio: newUser.bio,
        website: newUser.website,
        profile_image_url: newUser.profile_image_url,
        referral_code: newUser.referral_code
      },
    });
    return;
  } catch (error: any) {
    console.error('[signup error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

export const login: RequestHandler = async (req, res) => {
  // ... existing login method ...
  try {
    const { identifier, password } = req.body; // identifier can be username or email

    if (!identifier || !password) {
      res.status(400).json({ success: false, error: 'Missing identifier or password' });
      return;
    }

    // Find user
    const user = await knex('users')
      .where({ username: identifier })
      .orWhere({ email: identifier })
      .first();

    if (!user || !user.password_hash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Create JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullname: user.fullname,
        profile_image_url: user.profile_image_url,
        referral_code: user.referral_code,
      },
    });
    return;
  } catch (error: any) {
    console.error('[login error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

/**
 * Handle OTP-based passwordless signup and login
 */
export const otpAuth: RequestHandler = async (req, res) => {
  try {
    const {
      identifier,
      code,
      fullname,
      bio,
      profile_image_url,
      website,
      username: requestedUsername
    } = req.body; // identifier is email or phone

    if (!identifier || !code) {
      res.status(400).json({ success: false, error: 'Identifier and OTP code are required' });
      return;
    }

    // 1. Verify OTP
    const isValid = await otpService.verifyOTP(identifier, code);
    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid or expired OTP code' });
      return;
    }

    // 2. Check if user exists
    let user = await knex('users')
      .where({ email: identifier })
      .orWhere({ phone_number: identifier })
      .first();

    let isNewUser = false;

    // 3. Create user if doesn't exist (Signup)
    if (!user) {
      isNewUser = true;
      const isEmail = identifier.includes('@');
      const newUserId = uuidv4();

      // Handle username: use requested one or generate from identifier
      let username = requestedUsername;
      if (!username) {
        const baseUsername = isEmail ? identifier.split('@')[0] : `user_${identifier.slice(-4)}`;
        username = baseUsername;

        // Ensure unique username if generated
        const existingUsername = await knex('users').where({ username }).first();
        if (existingUsername) {
          username = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
        }
      } else {
        // If username was requested, check if it's already taken
        const existingUsername = await knex('users').where({ username }).first();
        if (existingUsername) {
          res.status(400).json({ success: false, error: 'Username is already taken' });
          return;
        }
      }

      [user] = await knex('users')
        .insert({
          id: newUserId,
          username,
          fullname: fullname,
          bio: bio,
          profile_image_url: profile_image_url,
          website: website,
          email: isEmail ? identifier : null,
          phone_number: isEmail ? null : identifier,
          joined_date: new Date(),
          referral_code: generateReferralCode(username, newUserId)
        })
        .returning('*');
    }

    // 4. Create JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '10d' });

    res.json({
      success: true,
      message: isNewUser ? 'Signup successful' : 'Login successful',
      isNewUser,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
        fullname: user.fullname,
        profile_image_url: user.profile_image_url,
        bio: user.bio,
        website: user.website,
        referral_code: user.referral_code,
      },
    });
    return;
  } catch (error: any) {
    console.error('[otpAuth error]', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
};

