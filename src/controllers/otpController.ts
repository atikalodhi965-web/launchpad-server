import { Request, Response, RequestHandler } from 'express';
import * as otpService from '../services/otpService';

export const requestOTP: RequestHandler = async (req, res) => {
  try {
    const { identifier, type } = req.body; // type: 'email' or 'phone'

    if (!identifier) {
       res.status(400).json({ success: false, error: 'Identifier (email or phone) is required' });
       return;
    }

    const code = otpService.generateOTP();
    await otpService.saveOTP(identifier, code);

    if (type === 'phone' || identifier.includes('+')) {
      await otpService.sendSMSOTP(identifier, code);
    } else {
      await otpService.sendEmailOTP(identifier, code);
    }

     res.json({
      success: true,
      message: `OTP sent successfully to ${identifier}`,
    });
    return;
  } catch (error: any) {
    console.error('[requestOTP error]', error);
     res.status(500).json({ success: false, error: error.message });
     return;
  }
};

export const verifyOTP: RequestHandler = async (req, res) => {
  try {
    const { identifier, code } = req.body;

    if (!identifier || !code) {
       res.status(400).json({ success: false, error: 'Identifier and code are required' });
       return;
    }

    const isValid = await otpService.verifyOTP(identifier, code);

    if (!isValid) {
       res.status(400).json({ success: false, error: 'Incorrect code' });
       return;
    }

     res.json({
      success: true,
      message: 'OTP verified successfully',
    });
    return;
  } catch (error: any) {
    console.error('[verifyOTP error]', error);
     res.status(500).json({ success: false, error: error.message });
     return;
  }
};
