import knex from '../db/knex';
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.lookup("smtp.gmail.com", { all: true }, (err, addresses) => {
  console.log("SMTP addresses:", addresses);
});
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import twilio from 'twilio';


// Email configuration
const isGmail = process.env.EMAIL_HOST?.includes('gmail');
const transporterConfig: any = isGmail ? {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
} : {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
};

// Add connection pooling and timeouts
const transporter = nodemailer.createTransport({
  ...transporterConfig,
  // pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 20000, // 20 seconds
  greetingTimeout: 20000,
  socketTimeout: 30000,
  logger: true, // Enable logging
  debug: true,  // Enable debug output
});



// SMS configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  process.env.TWILIO_AUTH_TOKEN || 'your_auth_token'
);

export const generateOTP = (): string => {
  // Generate a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendSMSOTP = async (phone: string, code: string) => {
  console.log(`[SMS Service] Sending OTP ${code} to ${phone}`);
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('-----------------------------------------');
      console.log(`[DEV MODE] SMS OTP for ${phone}: ${code}`);
      console.log('-----------------------------------------');
    }

    await twilioClient.messages.create({
      body: `Your MoonPad verification code is: ${code}. It expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return true;
  } catch (error) {
    console.error('[sendSMSOTP error]', error);
    throw error;
  }
};

export const sendEmailOTP = async (email: string, code: string) => {
  console.log(`[Email Service] Sending OTP ${code} to ${email}`);
  try {
    // In development, we can skip the actual email sending if SMTP is not configured
    // but we still want to log it so the developer can see the code.
    if (process.env.NODE_ENV === 'development') {
      console.log('-----------------------------------------');
      console.log(`[DEV MODE] OTP for ${email}: ${code}`);
      console.log('-----------------------------------------');
      // If you want to force test the real email in dev, comment out the line below
      // return true; 
    }

    console.log("Testing SMTP connection...");
    await transporter.verify();
    console.log("SMTP connection successful");

    await transporter.sendMail({
      from: `"MoonPad" <${process.env.EMAIL_FROM || 'noreply@moonpad.com'}>`,
      to: email,
      subject: 'Your MoonPad Verification Code',
      text: `Your MoonPad verification code is: ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Welcome to MoonPad</h2>
          <p>Use the following code to verify your identity:</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 5px;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[sendEmailOTP error]', error);
    // Only return true in development if we want to bypass the error
    // but the user's issue is that it's "giving success message" when it fails.
    // So we should throw the error so the controller handles it.
    throw error;
  }
};

export const saveOTP = async (identifier: string, code: string) => {
  // Delete any existing codes for this identifier to prevent bloating
  await knex('otps').where({ identifier }).del();

  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  await knex('otps').insert({
    id: uuidv4(),
    identifier,
    code,
    expires_at,
    verified: false
  });
};

export const verifyOTP = async (identifier: string, code: string): Promise<boolean> => {
  const otp = await knex('otps')
    .where({ identifier, code })
    .andWhere('expires_at', '>', new Date())
    .first();

  if (!otp) return false;

  await knex('otps').where({ id: otp.id }).update({ verified: true });
  return true;
};

export const checkOTPVerified = async (identifier: string): Promise<boolean> => {
  const otp = await knex('otps')
    .where({ identifier, verified: true })
    .first();

  if (otp) {
    // Optionally delete it after checking to ensure it's only used once
    await knex('otps').where({ id: otp.id }).del();
    return true;
  }
  return false;
};

