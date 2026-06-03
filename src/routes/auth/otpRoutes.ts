import { Router } from 'express';
import * as otpController from '../../controllers/otpController';

const otpRouter = Router();

// Send OTP to email or phone
otpRouter.post('/send', otpController.requestOTP);

// Verify OTP
otpRouter.post('/verify', otpController.verifyOTP);

export default otpRouter;
