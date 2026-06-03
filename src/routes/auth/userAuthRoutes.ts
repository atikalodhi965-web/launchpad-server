import { Router } from 'express';
import * as authController from '../../controllers/authController';

const userAuthRouter = Router();

// Signup
userAuthRouter.post('/signup', authController.signup);

// Login
userAuthRouter.post('/login', authController.login);

// OTP Authentication (Signup/Login)
userAuthRouter.post('/otp-auth', authController.otpAuth);

export default userAuthRouter;
