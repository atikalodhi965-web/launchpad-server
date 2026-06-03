import axios from 'axios';
import OpenAI from 'openai';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Trigger Cloudflare Stream ingestion from R2 URL
 */
export async function ingestToCloudflareStream(videoUrl: string) {
  try {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        url: videoUrl,
        meta: {
          name: "Creator Video",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.result; // contains uid, hls, dash, etc.
  } catch (err: any) {
    console.error('[CloudflareStream] Error:', err.response?.data || err.message);
    throw new Error('Failed to ingest video to Cloudflare Stream');
  }
}

/**
 * Moderate video using OpenAI Vision
 * Screens thumbnail + first frame for content policy
 */
export async function moderateVideo(thumbnailUrl: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image for content policy violations. Specifically looking for: Explicit violence, hate speech, pornography, or illegal crypto promotion scams. Respond in JSON format with 'approved' (boolean) and 'reason' (string)." },
            {
              type: "image_url",
              image_url: {
                "url": thumbnailUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    // Parse the JSON from the content
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse moderation result from OpenAI");

    return JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    console.error('[OpenAIVision] Moderation Error:', err.message);
    throw new Error('Failed to moderate video with OpenAI Vision');
  }
}

/**
 * Check Cloudflare Stream Status
 */
export async function checkStreamStatus(streamId: string) {
  const response = await axios.get(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${streamId}`,
    {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`,
      },
    }
  );
  return response.data.result;
}
