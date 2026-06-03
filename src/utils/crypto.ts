import crypto from 'crypto';

const ENC_KEY = (process.env.SECRET_ENC_KEY || '').padEnd(32, '0').slice(0, 32); // 32 bytes
const IV_LEN = 12; // GCM nonce

export function encryptB64(plain: Buffer): string {
const iv = crypto.randomBytes(IV_LEN);
const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENC_KEY), iv);
const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
const tag = cipher.getAuthTag();
return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptB64(encB64: string): Buffer {
const raw = Buffer.from(encB64, 'base64');
const iv = raw.subarray(0, IV_LEN);
const tag = raw.subarray(IV_LEN, IV_LEN + 16);
const data = raw.subarray(IV_LEN + 16);
const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENC_KEY), iv);
decipher.setAuthTag(tag);
return Buffer.concat([decipher.update(data), decipher.final()]);
}