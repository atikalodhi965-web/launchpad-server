import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "https://launchpad-app-video.31159709cde505adc051f8d704a0ee35.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "PLACEHOLDER",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "PLACEHOLDER",
  },
});

export const getUploadUrl = async (fileType: string) => {
  const extension = fileType.includes('/') ? fileType.split('/')[1] : 'mp4';
  const key = `uploads/${uuidv4()}-${Date.now()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || "videos",
    Key: key,
    ContentType: fileType,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  return { url, key };
};

export const getR2PublicUrl = (key: string) => {
  const bucketName = process.env.R2_BUCKET_NAME || "launchpad-app-video";
  const bucketDomain = process.env.R2_PUBLIC_DOMAIN || "https://pub-ab61c072ff69497c83f43d117ce244c1.r2.dev";
  return `${bucketDomain}/${bucketName}/${key}`;
};
