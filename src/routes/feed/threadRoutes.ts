import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllPosts,
  createRootPost,
  createReply,
  deletePost,
  addReaction,
  createRetweet,
  updatePost,
} from '../../controllers/threadController';
import { getPastTrades } from '../../services/pastTrades';
import axios from 'axios';
import knex from '../../db/knex';
import { Trade } from '../../types/interfaces';
const threadRouter = Router();
import { GET_MARKETCAP_OF_TOKEN, SIMPLE_PAST_TRADES_QUERY,TOKEN_DETAIL } from '../../queries/allQueryFile';
// const walletAddresses = [
//   "9HCTuTPEiQvkUtLmTZvK6uch4E3pDynwJTbNw6jLhp9z",
//   "6kbwsSY4hL6WVadLRLnWV2irkMN2AvFZVAS8McKJmAtJ", 
//   "DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt",
//   "BTf4A2exGK9BCVDNzy65b9dUzXgMqB4weVkvTMFQsadd",
//   "GJA1HEbxGnqBhBifH9uQauzXSB53to5rhDrzmKxhSU65"
// ];


async function decodeMetadata(uri: string | undefined) {
  if (!uri) return null;
  try {
    let url = uri;
    if (uri.startsWith("ipfs://")) {
      url = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
    } else if (uri.startsWith("ar://")) {
      url = uri.replace("ar://", "https://arweave.net/");
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.image ?? null;
  } catch {
    return null;
  }
}
// Utility wrapper for async route handlers
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET all posts
threadRouter.get('/posts', asyncHandler(getAllPosts));

// Create a root post
// Body: { userId, sections }
threadRouter.post('/posts', asyncHandler(createRootPost));

// Create a reply
// Body: { parentId, userId, sections }
threadRouter.post('/posts/reply', asyncHandler(createReply));

// Delete a post
threadRouter.delete('/posts/:postId', asyncHandler(deletePost));

// Add a reaction to a post
// Body: { reactionEmoji }
threadRouter.patch('/posts/:postId/reaction', asyncHandler(addReaction));

// threadRouter.get('/getPastTrades', async (req, res) => {
//   const trades = await getPastTrades(walletAddresses);
//   res.json(trades); // safe, pure JSON
// });



// ==== Helper to fetch token details ====
async function fetchTokenDetails(mintAddress: string): Promise<{
  marketCap: number | null;
  priceChange24h: number | null;
}> {
  try {
    const response = await axios.post(
      "https://streaming.bitquery.io/eap",
      {
        query: TOKEN_DETAIL,
        variables: { mintAddress },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BITQUERY_AUTH_TOKEN}`,
        },
      }
    );

    const solana = response.data?.data?.Solana;

    // Supply
    const supplyUpdate = solana?.TokenSupplyUpdates?.[0]?.TokenSupplyUpdate;
    const postBalance = supplyUpdate?.PostBalance ?? 0;
    const postBalanceUSD = supplyUpdate?.PostBalanceInUSD ?? 0;

    // Latest price
    const latestPrice = solana?.LatestPrice?.[0]?.Trade?.PriceInUSD 
      ?? solana?.LatestPrice?.[0]?.Trade?.Price 
      ?? 0;

    // Market cap calculation
    let marketCap: number | null = null;
    if (postBalanceUSD && postBalanceUSD > 0) {
      marketCap = postBalanceUSD;
    } else if (postBalance && postBalance > 0 && latestPrice > 0) {
      marketCap = postBalance * latestPrice;
    }

    // Price change 24h
    const priceChange24h = solana?.PriceChange24h?.[0]?.PriceChange24h ?? null;

    return {
      marketCap,
      priceChange24h,
    };
  } catch (err: any) {
    console.error(`❌ Error fetching details for ${mintAddress}:`, err.message);
    return { marketCap: null, priceChange24h: null };
  }
}

// ==== Route ====
threadRouter.get("/past-trades", async (req: Request, res: Response) => {
  try {
    // 1. Fetch watched wallets from DB
    const wallets = await knex("watched_addresses").select(
      "address",
      "username",
      "profile_image_url"
    );
    const walletAddresses = wallets.map((w) => w.address);

    // 2. Query past trades from Bitquery
    const response = await axios.post(
      "https://streaming.bitquery.io/eap",
      {
        query: SIMPLE_PAST_TRADES_QUERY,
        variables: { walletAddresses },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BITQUERY_AUTH_TOKEN}`,
        },
      }
    );

    const trades = response.data.data?.Solana?.DEXTradeByTokens ?? [];

    // 3. Enrich with market cap + price change
    const formatted = await Promise.all(
      trades.map(async (t: any) => {
        const wallet = wallets.find(
          (w) => w.address === t.Trade.Account.Address
        );

        // Decode token metadata
        let imageUrl: string | null = null;
        if (t.Trade.Side.Currency.Uri) {
          imageUrl = await decodeMetadata(t.Trade.Side.Currency.Uri);
        }

        // ✅ Fetch token details (market cap + price change)
        const mintAddress = t.Trade.Side.Currency.MintAddress;
        const { marketCap, priceChange24h } = mintAddress
          ? await fetchTokenDetails(mintAddress)
          : { marketCap: null, priceChange24h: null };

        return {
          wallet: t.Trade.Account.Address,
          username: wallet?.username ?? "Unknown",
          userProfilePic: wallet?.profile_image_url ?? null,
          action: t.Trade.Side.Type,
          token: {
            name: t.Trade.Side.Currency.Name,
            symbol: t.Trade.Side.Currency.Symbol,
            // mintAddress,
            imageUrl,
          },
          time: t.Block.Time,
          pnl: -231, // TODO: replace with real calculation
          solPrice: t.Trade.Amount,
          marketCapAtTrade: marketCap,
          currentMarketCap: marketCap,
          priceChange24h, // ✅ added
        };
      })
    );

    res.json(formatted);
  } catch (err: any) {
    console.error("❌ Error fetching past trades:", err.message);
    res.status(500).json({ error: "Failed to fetch past trades" });
  }
});




// Retweet
// Body: { retweetOf, userId, sections? }
threadRouter.post('/posts/retweet', asyncHandler(createRetweet));

// Update a post's sections
// Body: { postId, sections }
threadRouter.patch('/posts/update', asyncHandler(updatePost));

export { threadRouter };
