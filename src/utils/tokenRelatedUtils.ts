const AUTH_TOKEN = process.env.BITQUERY_AUTH_TOKEN!;
import { BATCH_CREATION_TIME_OF_TOKEN, BATCH_GET_TOTAL_SUPPLY_OF_TOKEN, COMBINED_TOKEN_METRICS, GET_B_C_P_PROTOCOL_FAMILY, GET_TOKEN_ANALYTICS_QUERY, GET_TOKEN_HOLDERS_COUNT, GET_TOKEN_SNIPERS_QUERY, MULTIPLE_WALLET_FUNDED_AGE, TOKEN_TRADES_COUNT, tokenLiquidity, TOTAL_VOLUME_BUY_SELL } from "../queries/allQueryFile";
// import PQueue from "p-queue"; // lightweight concurrency limiter
import PQueue from "p-queue";
const BITQUERY_AUTH_TOKEN = process.env.BITQUERY_AUTH_TOKEN || "ory_at_jomauf73mcnEblNEwdUaSaKsNKs_kQ1rr9D4y7K9L7M.uJBshg2v14sLk3GwMXzLkaojs58pl4UHlarooW2lWzQ";
// Define cache at module level (shared across calls)
const analyticsCache = new Map<string, any>();
import crypto from "crypto";
// utils/tokenRelatedUtils.ts
import axios from "axios";
import knex from "../db/knex";
import { Knex } from "knex";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
// import knex from "../db/knex";
// export async function decodeMetadata(uri: string) {
//   try {
//     let url = uri;
//     if (uri.startsWith("ipfs://")) url = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
//     if (uri.startsWith("ar://")) url = uri.replace("ar://", "https://arweave.net/");

//     const res = await fetch(url);
//     if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.statusText}`);
//     return await res.json();
//   } catch (err) {
//     console.error("decodeMetadata error:", err);
//     return null;
//   }
// }

export async function getTokenAnalytics(mint: string) {
  if (analyticsCache.has(mint)) {
    return analyticsCache.get(mint);
  }

  try {
    const res = await fetch("https://streaming.bitquery.io/eap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        query: GET_TOKEN_ANALYTICS_QUERY,
        variables: { tokenMint: mint },
      }),
    });

    const json = await res.json();
    // console.log("analytics response:", JSON.stringify(json, null, 2));

    const analytics = json.data?.Solana || {};

    // Safely extract values with fallbacks
    const allTimeStats = analytics.all_time_trading_stats?.[0] ?? {};
    const currentStats = analytics.current_trading_stats?.[0] ?? {};
    const holderStats = analytics.holder_count?.[0] ?? {};

    const analyticsData = {
      totalBuys: allTimeStats.total_buys ?? 0,
      totalSells: allTimeStats.total_sells ?? 0,
      totalTrades: allTimeStats.total_trades ?? 0,
      allTimeVolumeUSD: allTimeStats.current_volume_usd ?? 0,

      currentVolumeUSD: currentStats.current_volume_usd ?? 0,
      holderCount: holderStats.total_holders ?? 0,
    };

    analyticsCache.set(mint, analyticsData);

    // Auto-expire after 5 minutes
    setTimeout(() => analyticsCache.delete(mint), 5 * 60 * 1000);

    return analyticsData;
  } catch (err) {
    console.error("getTokenAnalytics error:", err);
    return {
      totalBuys: 0,
      totalSells: 0,
      totalTrades: 0,
      allTimeVolumeUSD: 0,
      currentVolumeUSD: 0,
      holderCount: 0,
    };
  }
}
const DETAIL_BATCH_SIZE = 10;

// src/fetchTokenDetailBatch.ts
export function computeLiquidityUSD(pool: any): number | null {
  if (!pool?.Base || !pool?.Quote) return null;

  const baseAmount = Number(pool.Base.PostAmount || 0);
  const baseUSD = Number(pool.Base.PostAmountInUSD || 0);
  const quoteAmount = Number(pool.Quote.PostAmount || 0);
  const quoteUSD = Number(pool.Quote.PostAmountInUSD || 0);

  if (baseUSD > 0 && quoteUSD > 0) {
    return baseUSD + quoteUSD;
  }

  if (quoteUSD > 0 && baseAmount > 0) {
    const priceBase = quoteUSD / baseAmount;
    return baseAmount * priceBase + quoteUSD;
  }

  if (baseUSD > 0 && quoteAmount > 0) {
    const priceQuote = baseUSD / quoteAmount;
    return baseUSD + quoteAmount * priceQuote;
  }

  return null;
}

export async function fetchTokenDetailBatch(tokens: any[]): Promise<any[]> {
  for (let i = 0; i < tokens.length; i += DETAIL_BATCH_SIZE) {
    const batch = tokens.slice(i, i + DETAIL_BATCH_SIZE);
    const mintAddresses = batch.map((t) => t.mint);

    try {
      const res = await axios.post(
        process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
        {
          query: COMBINED_TOKEN_METRICS,
          variables: { mintAddresses },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BITQUERY_AUTH_TOKEN}`,
          },
          timeout: 60_000,
        }
      );

      const solanaData = res.data?.data?.Solana;
      if (!solanaData) continue;

      for (const tok of batch) {
        const mint = tok.mint;

        // --- Marketcap ---
        const supplyUpdate = solanaData.TokenSupplyUpdates?.find(
          (u: any) =>
            u.TokenSupplyUpdate?.Currency?.MintAddress === mint
        )?.TokenSupplyUpdate;

        const latestPrice = solanaData.PriceMetrics?.find(
          (p: any) => p.Trade?.Currency?.MintAddress === mint
        )?.Trade?.PriceInUSD;

        let marketcap: number | null = null;
        if ((supplyUpdate?.PostBalanceInUSD ?? 0) > 0) {
          marketcap = supplyUpdate.PostBalanceInUSD;
        } else if (supplyUpdate?.PostBalance && latestPrice) {
          marketcap = Number(supplyUpdate.PostBalance) * Number(latestPrice);
        }

        // --- Price Change 24h ---
        const priceChangeEntry = solanaData.PriceChange24h?.find(
          (pc: any) => pc.Trade?.Currency?.MintAddress === mint
        );
        const priceChange24h = priceChangeEntry?.PriceChange24hPercent ?? null;

        // --- Volume 1h ---
        const volumeEntry = solanaData.VolumeMetrics?.find(
          (v: any) => v.Trade?.Currency?.MintAddress === mint
        );
        const volume1h = volumeEntry?.volume_usd_1h
          ? Number(volumeEntry.volume_usd_1h)
          : null;

        // --- Liquidity (by mint, not market) ---
        const liquidityEntry = solanaData.LiquidityMetrics?.find(
          (l: any) =>
            l.Pool?.Market?.BaseCurrency?.MintAddress === mint
        );
        const liquidityUSD = liquidityEntry
          ? computeLiquidityUSD(liquidityEntry.Pool)
          : null;

        // --- Assign to token ---
        tok.marketcap = marketcap;
        tok.price_change_24h = priceChange24h;
        tok.volume_usd_1h = volume1h;
        tok.liquidity_usd = liquidityUSD;
      }
    } catch (err: any) {
      console.warn("⚠️ fetchTokenDetailBatch failed:", err.message);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return tokens;
}

/* -----------------------------
   STRONG RATE-LIMIT CONTROL
------------------------------*/
const queue = new PQueue({
  concurrency: 5,      // Max 5 active requests at the same time
  intervalCap: 10,     // Max 10 requests per second
  interval: 1000       // 1-second rate window
});

/* -----------------------------
   SIMPLE RETRY WRAPPER
------------------------------*/
async function httpGetWithRetry(url: string, retries = 3, delayMs = 500) {
  let lastErr;

  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, { timeout: 15000 });
    } catch (err: any) {
      lastErr = err;
      if (i < retries - 1) {
        const wait = delayMs * (i + 1);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  throw lastErr;
}

/* -----------------------------
   IN-MEMORY CACHE
------------------------------*/
const cache = new Map<string, Metadata | null>();

/* -----------------------------
   IPFS GATEWAYS
------------------------------*/
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cf-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/"
];

/* -----------------------------
   METADATA INTERFACE
------------------------------*/
export interface Metadata {
  image?: string | null;
  createdOn?: string | null;
  telegram?: string | null;
  twitter?: string | null;
  website?: string | null;
  tiktok?: string | null;
  description?: string | null;
  [key: string]: any;        // allows additional metadata fields
}

function normalizeIpfsUri(uri: string): string {
  if (!uri) return uri;

  // Matches ANY form of "https://xxx/ipfs/<cid>"
  const match = uri.match(/https?:\/\/[^/]+\/ipfs\/([^/?#]+)/);
  if (match && match[1]) {
    return `ipfs://${match[1]}`;
  }

  return uri; // keep as is
}


/* -----------------------------
   MAIN DECODER
------------------------------*/
export async function decodeMetadata(uri?: string | null): Promise<Metadata | null> {
  if (!uri) return null;

  // NEW — normalize all http ipfs links → ipfs://CID
  uri = normalizeIpfsUri(uri);

  if (cache.has(uri)) return cache.get(uri)!;
  return queue.add(async () => {
    try {
      let url = uri;

      /* ---------- IPFS HANDLING ----------*/
      if (uri.startsWith("ipfs://")) {
        const cid = uri.replace("ipfs://", "");
        const shuffled = [...IPFS_GATEWAYS].sort(() => Math.random() - 0.5);

        for (const gateway of shuffled) {
          try {
            const res = await httpGetWithRetry(`${gateway}${cid}`);

            const raw = res.data || {};
            const meta: Metadata = {
              image: raw.image ?? null,
              description: raw.description ?? null,
              createdOn: raw.createdOn ?? null,
              telegram: raw.telegram ?? null,
              twitter: raw.twitter ?? null,
              website: raw.website ?? null,
              tiktok: raw.tiktok ?? null,
              ...raw
            };

            cache.set(uri, meta);
            return meta;
          } catch (err: any) {
            console.warn(`⚠️ IPFS fail @ ${gateway} —`, cid, err.message);
          }
        }

        cache.set(uri, null);
        return null;
      }

      /* ---------- ARWEAVE HANDLING ----------*/
      if (uri.startsWith("ar://")) {
        url = uri.replace("ar://", "https://arweave.net/");
      }

      /* ---------- HTTP METADATA ----------*/
      const res = await httpGetWithRetry(url);
      const raw = res.data || {};

      const meta: Metadata = {
        image: raw.image ?? null,
        description: raw.description ?? null,
        createdOn: raw.createdOn ?? null,
        telegram: raw.telegram ?? null,
        twitter: raw.twitter ?? null,
        website: raw.website ?? null,
        tiktok: raw.tiktok ?? null,
        ...raw
      };

      cache.set(uri, meta);
      return meta;
    } catch (err: any) {
      console.warn("⚠️ decodeMetadata final fail:", uri, err.message);
      cache.set(uri, null);
      return null;
    }
  });
}

/* -----------------------------
   BATCH DECODER
------------------------------*/
export async function decodeMetadataBatch(
  uris: (string | null | undefined)[]
): Promise<(Metadata | null)[]> {
  return Promise.all(uris.map((uri) => decodeMetadata(uri)));
}

export function timeAgo(timestamp: string): string {
  const now = new Date().getTime();
  const past = new Date(timestamp).getTime();

  const diffMs = now - past;

  // If the time is in the future
  if (diffMs < 0) {
    return "just now";
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}


export async function getCreationTimeAndSupplyBatch(
  mintAddresses: string[]
): Promise<Record<string, { created_on: string | null; total_supply: number | null }>> {
  if (!mintAddresses.length) return {};

  const result: Record<string, { created_on: string | null; total_supply: number | null }> = {};

  mintAddresses.forEach((mint) => {
    result[mint] = {
      created_on: null,
      total_supply: null
    };
  });

  try {
    // ----------- Fetch Creation Times -----------
    const creationRes = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: BATCH_CREATION_TIME_OF_TOKEN,
        variables: { mintAddresses }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
        },
        timeout: 120_000,
      }
    );

    const creationRows = creationRes.data?.data?.Solana?.DEXTradeByTokens ?? [];
    // console.log("creation Result: ", creationRows);

    for (const row of creationRows) {
      const mint = row?.Trade?.Currency?.MintAddress;
      const time = row?.Block?.Time;
      if (mint && result[mint]) {
        result[mint].created_on = time ?? null;
      }
    }

    // ----------- Fetch Total Supply -----------
    const supplyRes = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: BATCH_GET_TOTAL_SUPPLY_OF_TOKEN,
        variables: { mintAddresses }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
        },
        timeout: 120_000,
      }
    );

    const supplyRows = supplyRes.data?.data?.Solana?.TokenSupplyUpdates ?? [];
    // console.log("supply rows: ", supplyRows);
    for (const row of supplyRows) {
      const update = row?.TokenSupplyUpdate;
      if (!update) continue;

      const mint = update.Currency?.MintAddress;
      const supply = Number(update.PostBalance ?? "0");

      if (mint && result[mint]) {
        result[mint].total_supply = isNaN(supply) ? null : supply;
      }
    }

    return result;
  } catch (err: any) {
    console.error("❌ Error in getCreationTimeAndSupplyBatch:", err.message);
    return result;
  }
}
export async function getMarketMetricsBatch(
  mintAddresses: string[]
): Promise<
  Record<
    string,
    {
      current_price: number | null;
      market_cap: number | null;
      price_change_24h: number | null;
      ath_price: number | null;
      ath_marketcap: number | null;
    }
  >
> {
  if (!mintAddresses.length) return {};

  const result: Record<
    string,
    {
      current_price: number | null;
      market_cap: number | null;
      price_change_24h: number | null;
      ath_price: number | null;
      ath_marketcap: number | null;
    }
  > = {};

  // initialize defaults
  mintAddresses.forEach((mint) => {
    result[mint] = {
      current_price: null,
      market_cap: null,
      price_change_24h: null,
      ath_price: null,
      ath_marketcap: null,
    };
  });

  try {
    const res = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: COMBINED_TOKEN_METRICS,
        variables: { mintAddresses },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
        },
        timeout: 120_000,
      }
    );

    const solanaData = res.data?.data?.Solana;
    if (!solanaData) return result;

    const supplyUpdates = solanaData.TokenSupplyUpdates ?? [];
    const priceMetrics = solanaData.PriceMetrics ?? [];
    const priceChanges = solanaData.PriceChange24h ?? [];

    for (const mint of mintAddresses) {
      // -------- Current Price --------
      const latestPriceEntry = priceMetrics.find(
        (p: any) => p?.Trade?.Currency?.MintAddress === mint
      );

      const currentPrice = latestPriceEntry?.Trade?.PriceInUSD
        ? Number(latestPriceEntry.Trade.PriceInUSD)
        : null;

      // -------- Supply --------
      const supplyEntry = supplyUpdates.find(
        (u: any) =>
          u?.TokenSupplyUpdate?.Currency?.MintAddress === mint
      )?.TokenSupplyUpdate;

      // -------- Market Cap --------
      let marketCap: number | null = null;

      if ((supplyEntry?.PostBalanceInUSD ?? 0) > 0) {
        marketCap = Number(supplyEntry.PostBalanceInUSD);
      } else if (supplyEntry?.PostBalance && currentPrice) {
        marketCap =
          Number(supplyEntry.PostBalance) * Number(currentPrice);
      }

      // -------- Price Change 24h --------
      const priceChangeEntry = priceChanges.find(
        (pc: any) => pc?.Trade?.Currency?.MintAddress === mint
      );

      const priceChange24h =
        priceChangeEntry?.PriceChange24hPercent != null
          ? Number(priceChangeEntry.PriceChange24hPercent)
          : null;

      // -------- ATH Price and Market Cap --------
      // For now, set ATH to current values. In production, track historical max
      const athPrice = currentPrice;
      const athMarketcap = marketCap;

      result[mint] = {
        current_price: currentPrice,
        market_cap: marketCap,
        price_change_24h: priceChange24h,
        ath_price: athPrice,
        ath_marketcap: athMarketcap,
      };
    }
    return result;
  } catch (err: any) {
    console.error("❌ Error in getMarketMetricsBatch:", err.message);
    return result;
  }
}

export type Holder = {
  address: string;
  balance: number;
  owner?: string;
};

export type HoldingsResult = {
  holding_top_10: number;
  holding_snipers: number;
  holder_count: number;
};

export type HoldingsResultByToken = Record<string, HoldingsResult>;

export async function calculateTop10HoldingPercent(
  holdersResponse: any,
  mintAddresses: string[]
): Promise<Record<string, number>> {
  try {
    if (!holdersResponse?.Solana?.BalanceUpdates) return {};

    // const url = process.env.BITQUERY_URL!;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
    };

    const supplyRes = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: BATCH_GET_TOTAL_SUPPLY_OF_TOKEN,
        variables: { mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const supplyByToken: Record<string, number> = {};
    for (const row of supplyRes.data?.data?.Solana?.TokenSupplyUpdates ?? []) {
      supplyByToken[row.TokenSupplyUpdate.Currency.MintAddress] =
        Number(row.TokenSupplyUpdate.PostBalance) || 0;
    }

    const holdersByToken: Record<string, number[]> = {};

    for (const row of holdersResponse.Solana.BalanceUpdates) {
      const mint = row.BalanceUpdate.Currency.MintAddress;
      if (!mintAddresses.includes(mint)) continue;

      holdersByToken[mint] ??= [];
      holdersByToken[mint].push(
        Number(row.BalanceUpdate.Holding) || 0
      );
    }

    const result: Record<string, number> = {};

    for (const mint of mintAddresses) {
      const balances = holdersByToken[mint] ?? [];
      const totalSupply = supplyByToken[mint];

      if (!totalSupply || totalSupply <= 0) {
        result[mint] = 0;
        continue;
      }

      const top10Sum = [...balances]
        .sort((a, b) => b - a)
        .slice(0, 10)
        .reduce((a, b) => a + b, 0);

      result[mint] = Number(
        ((top10Sum / totalSupply) * 100).toFixed(4)
      );
    }

    return result;
  } catch (err) {
    console.error("Top10 holding calc failed", err);
    return {};
  }
}

export async function calculateSniperHoldingPercent(
  holdersResponse: any,
  mintAddresses: string[],
  supplyByToken: Record<string, number>
): Promise<Record<string, number>> {
  try {
    if (!holdersResponse?.Solana?.BalanceUpdates) return {};

    // const url = process.env.BITQUERY_URL!;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
    };

    const sniperRes = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: GET_TOKEN_SNIPERS_QUERY,
        variables: { tokens: mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const Sn = sniperRes.data?.data?.Solana;
    if (!Sn) return {};

    const sniperWalletsByToken: Record<string, Set<string>> = {};

    for (const launch of Sn.launchMoment ?? []) {
      const mint = launch.Trade.Currency.MintAddress;
      sniperWalletsByToken[mint] ??= new Set();

      const launchTime = new Date(launch.Block.Time).getTime();
      const launchSlot = Number(launch.Block.Slot);

      for (const b of Sn.earlyBuyers ?? []) {
        if (b.Trade.Currency.MintAddress !== mint) continue;

        const buyTime = new Date(b.Block.Time).getTime();
        const buySlot = Number(b.Block.Slot);

        if (
          (buyTime - launchTime) / 1000 <= 3 ||
          buySlot <= launchSlot + 2
        ) {
          sniperWalletsByToken[mint].add(
            b.Trade.Account.Address
          );
        }
      }
    }

    const balancesByToken: Record<string, Map<string, number>> = {};

    for (const row of holdersResponse.Solana.BalanceUpdates) {
      const mint = row.BalanceUpdate.Currency.MintAddress;
      balancesByToken[mint] ??= new Map();
      balancesByToken[mint].set(
        row.BalanceUpdate.Account.Address,
        Number(row.BalanceUpdate.Holding) || 0
      );
    }

    const result: Record<string, number> = {};

    for (const mint of mintAddresses) {
      const snipers = sniperWalletsByToken[mint];
      const supply = supplyByToken[mint];

      if (!snipers || !supply || supply <= 0) {
        result[mint] = 0;
        continue;
      }

      let sum = 0;
      for (const wallet of snipers) {
        sum += balancesByToken[mint]?.get(wallet) ?? 0;
      }

      result[mint] = Number(
        ((sum / supply) * 100).toFixed(4)
      );
    }

    return result;
  } catch (err) {
    console.error("Sniper holding calc failed", err);
    return {};
  }
}

// export async function getTokenHolderCount(
//   mintAddresses: string[]
// ): Promise<Record<string, number>> {
//   try {
//     const headers = {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//     };

//     const res = await axios.post(
//       process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
//       {
//         query: GET_TOKEN_HOLDERS_COUNT,
//         variables: { mintAddresses },
//       },
//       { headers, timeout: 60000 }
//     );

//     // ✅ handle both Bitquery response shapes
//     const balanceUpdates =
//       res.data?.data?.Solana?.BalanceUpdates ??
//       res.data?.Solana?.BalanceUpdates ??
//       [];

//     const walletsByToken: Record<string, Set<string>> = {};

//     for (const row of balanceUpdates) {
//       const mint = row.BalanceUpdate.Currency.MintAddress;
//       const balance = Number(row.BalanceUpdate.Holding);

//       if (balance > 0) {
//         walletsByToken[mint] ??= new Set();
//         walletsByToken[mint].add(
//           row.BalanceUpdate.Account.Address
//         );
//       }
//     }

//     const result: Record<string, number> = {};
//     for (const mint of mintAddresses) {
//       result[mint] = walletsByToken[mint]?.size ?? 0;
//     }

//     return result;
//   } catch (err) {
//     console.error("Holder count failed", err);
//     return {};
//   }
// }

export async function getTokenHolderStats(
  mintAddresses: string[]
): Promise<{
  holderCount: Record<string, number>;
  top10HoldingPercent: Record<string, number>;
  sniperHoldingPercent: Record<string, number>;
  // top10Holders: Record<
  //   string,
  //   { address: string; balance: number }[]
  // >;
  // topHolderPercent: Record<string, number>;
  // topHolderAgeDays: Record<string, number>;
  // whaleHoldingPercent: Record<string, number>;
}> {
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
    };

    const url =
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap";

    // --------------------------------------------------
    // 1️⃣ Fetch holders snapshot
    // --------------------------------------------------
    const holdersRes = await axios.post(
      url,
      {
        query: GET_TOKEN_HOLDERS_COUNT,
        variables: { mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const balanceUpdates =
      holdersRes.data?.data?.Solana?.BalanceUpdates ??
      holdersRes.data?.Solana?.BalanceUpdates ??
      [];

    // --------------------------------------------------
    // 2️⃣ Fetch total supply (batch)
    // --------------------------------------------------
    const supplyRes = await axios.post(
      url,
      {
        query: BATCH_GET_TOTAL_SUPPLY_OF_TOKEN,
        variables: { mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const supplyByToken: Record<string, number> = {};
    for (const row of supplyRes.data?.data?.Solana?.TokenSupplyUpdates ?? []) {
      supplyByToken[row.TokenSupplyUpdate.Currency.MintAddress] =
        Number(row.TokenSupplyUpdate.PostBalance) || 0;
    }

    // --------------------------------------------------
    // 3️⃣ Fetch sniper data (batch)
    // --------------------------------------------------
    const sniperRes = await axios.post(
      url,
      {
        query: GET_TOKEN_SNIPERS_QUERY,
        variables: { tokens: mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const Sn = sniperRes.data?.data?.Solana ?? {};

    // --------------------------------------------------
    // 4️⃣ Build sniper wallets per token
    // --------------------------------------------------
    const sniperWalletsByToken: Record<string, Set<string>> = {};

    for (const launch of Sn.launchMoment ?? []) {
      const mint = launch.Trade.Currency.MintAddress;
      sniperWalletsByToken[mint] ??= new Set();

      const launchTime = new Date(launch.Block.Time).getTime();
      const launchSlot = Number(launch.Block.Slot);

      for (const b of Sn.earlyBuyers ?? []) {
        if (b.Trade.Currency.MintAddress !== mint) continue;

        const buyTime = new Date(b.Block.Time).getTime();
        const buySlot = Number(b.Block.Slot);

        const isSniper =
          (buyTime - launchTime) / 1000 <= 3 ||
          buySlot <= launchSlot + 2;

        if (isSniper) {
          sniperWalletsByToken[mint].add(
            b.Trade.Account.Address
          );
        }
      }
    }

    // --------------------------------------------------
    // 5️⃣ Aggregate balances
    // --------------------------------------------------
    const walletsByToken: Record<string, Set<string>> = {};
    const balancesByToken: Record<string, number[]> = {};
    const balanceLookup: Record<string, Map<string, number>> = {};

    for (const row of balanceUpdates) {
      const mint = row.BalanceUpdate.Currency.MintAddress;
      const wallet = row.BalanceUpdate.Account.Address;
      const balance = Number(row.BalanceUpdate.Holding) || 0;

      if (!mintAddresses.includes(mint)) continue;

      if (balance > 0) {
        walletsByToken[mint] ??= new Set();
        walletsByToken[mint].add(wallet);
      }

      balancesByToken[mint] ??= [];
      balancesByToken[mint].push(balance);

      balanceLookup[mint] ??= new Map();
      balanceLookup[mint].set(wallet, balance);
    }

    // --------------------------------------------------
    // 6️⃣ Compute metrics
    // --------------------------------------------------
    const holderCount: Record<string, number> = {};
    const top10HoldingPercent: Record<string, number> = {};
    const sniperHoldingPercent: Record<string, number> = {};
    // const whaleHoldingPercent: Record<string, number> = {};
    // const topHolderPercent: Record<string, number> = {};
    // const topHolderAgeDays: Record<string, number> = {};
    // const top10Holders: Record<
    //   string,
    //   { address: string; balance: number }[]
    // > = {};

    for (const mint of mintAddresses) {
      const balances = balancesByToken[mint] ?? [];
      const supply = supplyByToken[mint];

      holderCount[mint] = walletsByToken[mint]?.size ?? 0;

      if (!supply || supply <= 0) {
        top10HoldingPercent[mint] = 0;
        sniperHoldingPercent[mint] = 0;
        // top10Holders[mint] = [];
        continue;
      }

      // ---- Top 10 %
      const top10Sum = [...balances]
        .sort((a, b) => b - a)
        .slice(0, 10)
        .reduce((a, b) => a + b, 0);

      top10HoldingPercent[mint] = Number(
        ((top10Sum / supply) * 100).toFixed(4)
      );
      // console.log("supply: ", supply);
      // ---- NEW: Top 10 holders (address + balance)
      const walletBalances =
        [...(balanceLookup[mint]?.entries() ?? [])]
          .filter(([, bal]) => bal > 0)
          .map(([address, balance]) => ({ address, balance }));

      // top10Holders[mint] = walletBalances
      //   .sort((a, b) => b.balance - a.balance)
      //   .slice(0, 10);


      // ---- Sniper %
      let sniperSum = 0;
      for (const wallet of sniperWalletsByToken[mint] ?? []) {
        sniperSum += balanceLookup[mint]?.get(wallet) ?? 0;
      }

      sniperHoldingPercent[mint] = Number(
        ((sniperSum / supply) * 100).toFixed(4)
      );

      // ---- ✅ WHALE %
      // let whaleSum = 0;

      // for (const balance of balanceLookup[mint]?.values() ?? []) {
      //   if ((balance / supply) * 100 >= 1) {
      //     whaleSum += balance;
      //   }
      // }

      // whaleHoldingPercent[mint] = Number(
      //   ((whaleSum / supply) * 100).toFixed(4)
      // );
      // const topHolder = top10Holders[mint][0];

      // if (topHolder) {
      //   topHolderPercent[mint] = Number(
      //     ((topHolder.balance / supply) * 100).toFixed(4)
      //   );
      // } else {
      //   topHolderPercent[mint] = 0;
      // }

      // --------------------------------------------------
      // 7️⃣ Fetch top holder wallet funded age
      // --------------------------------------------------
      // const topHolderWallets = mintAddresses
      //   .map(mint => top10Holders[mint]?.[0]?.address)
      //   .filter(Boolean);
      // // console.log("top wallet holder: ", topHolderWallets);
      // const walletAges = await getWalletFundedAge(topHolderWallets);

      // for (const mint of mintAddresses) {
      //   const wallet = top10Holders[mint]?.[0]?.address;
      //   // console.log("wallet: ", wallet);
      //   topHolderAgeDays[mint] = wallet
      //     ? walletAges[wallet]?.ageDays ?? 0
      //     : 0;
      // }


    }

    return {
      holderCount,
      top10HoldingPercent,
      sniperHoldingPercent,
      // top10Holders,
      // whaleHoldingPercent,
      // topHolderAgeDays,
      // topHolderPercent,
    };
  } catch (err) {
    console.error("Token holder stats failed", err);
    return {
      holderCount: {},
      top10HoldingPercent: {},
      sniperHoldingPercent: {},
      // top10Holders: {},
      // whaleHoldingPercent: {},
      // topHolderPercent: {},
      // topHolderAgeDays: {},
    };
  }
}

export type WalletFundedAgeResult = Record<
  string,
  {
    firstFundedAt: string;
    ageDays?: number;
    ageHours?: number;
  }
>;


export async function getWalletFundedAge(
  wallets: string[]
): Promise<WalletFundedAgeResult> {
  if (!wallets.length) return {};

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
  };

  const url =
    process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap";

  const now = Date.now();
  const result: WalletFundedAgeResult = {};

  try {
    const res = await axios.post(
      url,
      {
        query: MULTIPLE_WALLET_FUNDED_AGE,
        variables: { addresses: wallets },
      },
      { headers, timeout: 60000 }
    );

    const transfers = res.data?.data?.Solana?.Transfers ?? [];

    if (!transfers.length) {
      console.warn("No funding transfers found for wallets:", wallets);
      return {};
    }

    for (const row of transfers) {
      if (!row?.Transfer?.Receiver?.Address || !row?.Block?.Time) {
        continue;
      }

      const wallet = row.Transfer.Receiver.Address;
      const firstFundedTime = new Date(row.Block.Time).getTime();

      if (Number.isNaN(firstFundedTime)) continue;

      const diffMs = now - firstFundedTime;

      // ⛔ Guard against future timestamps
      if (diffMs <= 0) {
        result[wallet] = {
          firstFundedAt: row.Block.Time,
          ageHours: 0,
        };
        continue;
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // ✅ Show hours if < 24h, else days
      result[wallet] = {
        firstFundedAt: row.Block.Time,
        ...(diffHours < 24
          ? { ageHours: diffHours }
          : { ageDays: diffDays }),
      };
    }

    return result;
  } catch (error: any) {
    console.error("getWalletFundedAge failed");

    if (error.response) {
      console.error("Bitquery response error:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      console.error("No response from Bitquery");
    } else {
      console.error("Unexpected error:", error.message);
    }

    return {};
  }
}



// src/solana/tradeStats.ts

type MintAddress = string;

// interface TradeStats {
//   mintAddress: MintAddress;
//   totalTrades: number;
//   buyTrades: number;
//   sellTrades: number;
//   volumeUsd24h: number;
//   buyVolumeUsd: number;
//   sellVolumeUsd: number;
// }

// interface GraphQLResponse<T> {
//   data?: T;
//   errors?: { message: string }[];
// }

export async function getTokenTradeStats(
  mintAddresses: string[]
): Promise<{
  totalTrades: Record<string, number>;
  buyTrades: Record<string, number>;
  sellTrades: Record<string, number>;
  volumeUsd24h: Record<string, number>;
  buyVolumeUsd: Record<string, number>;
  sellVolumeUsd: Record<string, number>;
}> {
  try {
    if (!mintAddresses.length) {
      return {
        totalTrades: {},
        buyTrades: {},
        sellTrades: {},
        volumeUsd24h: {},
        buyVolumeUsd: {},
        sellVolumeUsd: {},
      };
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
    };

    const url =
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap";

    // --------------------------------------------------
    // 1️⃣ Trade counts
    // --------------------------------------------------
    const tradesRes = await axios.post(
      url,
      {
        query: TOKEN_TRADES_COUNT,
        variables: { tokens: mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const tradeRows =
      tradesRes.data?.data?.Solana?.DEXTradeByTokens ?? [];

    const totalTrades: Record<string, number> = {};
    const buyTrades: Record<string, number> = {};
    const sellTrades: Record<string, number> = {};

    for (const row of tradeRows) {
      const mint = row.Trade.Currency.MintAddress;
      totalTrades[mint] = row.totalTrades ?? 0;
      buyTrades[mint] = row.buyTrades ?? 0;
      sellTrades[mint] = row.sellTrades ?? 0;
    }

    // --------------------------------------------------
    // 2️⃣ Volume stats
    // --------------------------------------------------
    const volumeRes = await axios.post(
      url,
      {
        query: TOTAL_VOLUME_BUY_SELL,
        variables: { mintAddresses },
      },
      { headers, timeout: 60000 }
    );

    const volumeRows =
      volumeRes.data?.data?.Solana?.DEXTradeByTokens ?? [];

    const volumeUsd24h: Record<string, number> = {};
    const buyVolumeUsd: Record<string, number> = {};
    const sellVolumeUsd: Record<string, number> = {};

    for (const row of volumeRows) {
      const mint = row.Trade.Currency.MintAddress;
      volumeUsd24h[mint] = row.volume_usd_24h ?? 0;
      buyVolumeUsd[mint] = row.buy_volume_usd ?? 0;
      sellVolumeUsd[mint] = row.sell_volume_usd ?? 0;
    }

    return {
      totalTrades,
      buyTrades,
      sellTrades,
      volumeUsd24h,
      buyVolumeUsd,
      sellVolumeUsd,
    };
  } catch (err) {
    console.error("Token trade stats failed", err);
    return {
      totalTrades: {},
      buyTrades: {},
      sellTrades: {},
      volumeUsd24h: {},
      buyVolumeUsd: {},
      sellVolumeUsd: {},
    };
  }
}
export interface TokenBondingInfo {
  mintAddress: string;
  creationTime: string | null;
  bondingCurveProgress: number | null;
  protocolFamily: string | null;
  bonding_current_amount: number | null;
  bonding_target_amount: number | null;
}
export async function getTokenLiquidity(
  mintAddresses: string[]
): Promise<Record<string, number>> {
  try {
    if (!mintAddresses.length) {
      return {};
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
    };

    const res = await axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: tokenLiquidity,
        variables: {
          tokenMints: mintAddresses,
        },
      },
      { headers, timeout: 60000 }
    );

    const pools =
      res.data?.data?.Solana?.DEXPools ?? [];

    const liquidityByMint: Record<string, number> = {};

    for (const row of pools) {
      const mint =
        row?.Pool?.Market?.BaseCurrency?.MintAddress;

      const quoteUsd =
        Number(row?.Pool?.Quote?.PostAmountInUSD ?? 0);

      if (!mint) continue;

      // Liquidity = 2 * quote side USD value
      liquidityByMint[mint] = quoteUsd * 2;
    }

    return liquidityByMint;
  } catch (err) {
    console.error("Token liquidity fetch failed", err);
    return {};
  }
}

export async function getTokenBondingInfo(
  mintAddresses: string[]
): Promise<TokenBondingInfo[]> {
  if (!mintAddresses.length) return [];
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
  };
  const [bondingRes, creationRes] = await Promise.all([
    axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: GET_B_C_P_PROTOCOL_FAMILY,
        variables: { tokens: mintAddresses },
      },
      { headers, timeout: 60_000 }
    ),
    axios.post(
      process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap",
      {
        query: BATCH_CREATION_TIME_OF_TOKEN,
        variables: { mintAddresses },
      },
      { headers, timeout: 60_000 }
    ),
  ]);

  const bondingPools =
    bondingRes.data?.data?.Solana?.DEXPools ?? [];

  const creationTrades =
    creationRes.data?.data?.Solana?.DEXTradeByTokens ?? [];

  const bondingMap = new Map<
    string,
    { progress: number; protocolFamily: string; currentAmount: number; targetAmount: number }
  >();

  for (const pool of bondingPools) {
    const mint =
      pool.Pool?.Market?.BaseCurrency?.MintAddress;

    if (!mint) continue;

    const baseBalance = Number(pool.Pool?.Base?.PostAmount ?? 0);
    // For Pump.fun: starts at ~20.69 SOL, targets ~1000 SOL
    const currentAmount = baseBalance / 1e9; // Convert lamports to SOL
    const targetAmount = 1000; // SOL

    bondingMap.set(mint, {
      progress: pool.PumpFun_BondingCurve_Progress ?? null,
      protocolFamily:
        pool.Pool?.Dex?.ProtocolFamily ?? null,
      currentAmount,
      targetAmount,
    });
  }

  const creationMap = new Map<string, string>();

  for (const trade of creationTrades) {
    const mint = trade.Trade?.Currency?.MintAddress;
    const time = trade.Block?.Time;

    if (mint && time) {
      creationMap.set(mint, time);
    }
  }

  return mintAddresses.map((mint) => ({
    mintAddress: mint,
    creationTime: creationMap.get(mint) ?? null,
    bondingCurveProgress:
      bondingMap.get(mint)?.progress ?? null,
    protocolFamily:
      bondingMap.get(mint)?.protocolFamily ?? null,
    bonding_current_amount: bondingMap.get(mint)?.currentAmount ?? null,
    bonding_target_amount: bondingMap.get(mint)?.targetAmount ?? null,
  }));
}

export async function fetchTransactionFeedRow(transactionId: string) {
  const rows = await knex
    .with("latest_token_stats", (qb) => {
      qb.select(
        "ts.token_mint",
        "ts.market_cap",
        knex.raw(`
          ROW_NUMBER() OVER (
            PARTITION BY ts.token_mint
            ORDER BY ts.created_on DESC
          ) AS rn
        `)
      ).from("token_stats as ts");
    })
    .select([
      "t.id as transaction_id",
      "t.type",
      "t.price_sol",
      "t.marketcap_at_trade as marketcapAtTrade",
      "t.total_usd",
      "t.created_at",

      "u.username",
      "u.profile_image_url",

      "tok.mint_address as token_mint",
      "tok.name as token_name",
      "tok.symbol as token_symbol",
      "tok.image as token_image",

      "lts.market_cap as token_market_cap",
      "tp.avg_buy_price",

      knex.raw(`
        CASE 
          WHEN t.type = 'SELL'
          THEN (t.price_usd - tp.avg_buy_price) * t.quantity
          ELSE 0
        END AS pnl_usd
      `),

      knex.raw(`
        CASE 
          WHEN t.type = 'SELL' AND tp.avg_buy_price > 0
          THEN (
            ((t.price_usd - tp.avg_buy_price) * t.quantity)
            / (tp.avg_buy_price * t.quantity)
          ) * 100
          ELSE 0
        END AS pnl_percent
      `),
    ])
    .from("transactions as t")
    .join("users as u", "u.privy_id", "t.user_privy_id")
    .join("tokens as tok", "tok.mint_address", "t.token_mint")
    .leftJoin("token_positions as tp", function () {
      this.on("tp.user_privy_id", "t.user_privy_id")
        .andOn("tp.token_mint", "t.token_mint");
    })
    .leftJoin("latest_token_stats as lts", function () {
      this.on("lts.token_mint", "t.token_mint")
        .andOn("lts.rn", "=", knex.raw("1"));
    })
    .where("t.id", transactionId)
    .first();

  return rows;
}
export const getCurrentTokenPriceUsd = async (
  mintAddress: string
): Promise<number> => {
  try {
    const response = await fetch(
      `https://lite-api.jup.ag/price/v3?ids=${mintAddress}`
    );

    if (!response.ok) {
      console.warn(
        `[PricingService] Jupiter API status ${response.status} for mint ${mintAddress}`
      );
      return 0; // 🔧 CHANGE: do NOT throw
    }

    const data = await response.json();

    const tokenData = data?.[mintAddress];
    const price = tokenData?.usdPrice;

    if (!price || Number(price) <= 0) {
      console.warn(
        `[PricingService] Invalid or missing price for mint ${mintAddress}`
      );
      return 0; // 🔧 CHANGE: do NOT throw
    }

    return Number(price);
  } catch (err) {
    console.error(
      `[PricingService] Failed to fetch price for mint ${mintAddress}`,
      err
    );
    return 0; // 🔧 CHANGE: swallow error
  }
};



export function generateReferralCode(username: string, privyId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(privyId)
    .digest("hex")
    .slice(0, 6);

  return `${username.toLowerCase()}-${hash}`;
}

export function detectProtocolFromMint(mint: string): string | null {
  const upper = mint.toUpperCase();

  if (upper.endsWith("BAGS")) return "BAGS";
  if (upper.endsWith("MOON")) return "MOON";
  if (upper.endsWith("RAY")) return "RAY";
  if (upper.endsWith("BONK")) return "BONK";
  if (upper.endsWith("BLV")) return "BLV";
  if (upper.endsWith("BOOP")) return "BOOP";
  if (upper.endsWith("JUPX")) return "JUPX";
  if (upper.endsWith("PUMP")) return "Pump";


  return null;
}

export function applyFilters(
  qb: Knex.QueryBuilder,
  filters: any
) {
  if (!filters) return;

  const range = (col: string, v: any) => {
    if (v.min !== undefined) qb.andWhere(col, ">=", v.min);
    if (v.max !== undefined) qb.andWhere(col, "<=", v.max);
  };

  if (filters.marketCap) range("token_stats.market_cap", filters.marketCap);
  if (filters.volume) range("token_stats.volume_24h", filters.volume);
  if (filters.liquidity) range("token_stats.liquidity", filters.liquidity);
  if (filters.txns) range("token_stats.tx_count", filters.txns);
  if (filters.numBuys) range("token_stats.num_buys", filters.numBuys);
  if (filters.numSells) range("token_stats.num_sells", filters.numSells);

  if (filters.holders) range("launchpad_tokens.holders", filters.holders);

  if (filters.top10Holders) range("token_stats.holding_top_10", filters.top10Holders);
  if (filters.devHolding) range("token_stats.holding_dev", filters.devHolding);
  if (filters.snipers) range("token_stats.holding_snipers", filters.snipers);
  if (filters.insiders) range("token_stats.holding_insiders", filters.insiders);
  if (filters.bundles) range("token_stats.holding_bundle", filters.bundles);

  if (filters.curve) range("launchpad_tokens.bonding_curve_progress", filters.curve);

  if (filters.age) {
    const now = new Date();
    if (filters.age.min !== undefined) {
      qb.andWhere("launchpad_tokens.time", "<=", new Date(now.getTime() - filters.age.min * 3600_000));
    }
    if (filters.age.max !== undefined) {
      qb.andWhere("launchpad_tokens.time", ">=", new Date(now.getTime() - filters.age.max * 3600_000));
    }
  }

  if (filters.hasTwitter)
    qb.whereNotNull("launchpad_tokens.social_twitter");

  if (filters.hasWebsite)
    qb.whereNotNull("launchpad_tokens.social_website");

  if (filters.hasTelegram)
    qb.whereNotNull("launchpad_tokens.social_telegram");
}

export function dedupeByMintCategory(rows: any[]) {
  const map = new Map<string, any>();

  for (const r of rows) {
    const key = `${r.mint}:${r.category}`;
    map.set(key, r); // last-write-wins
  }

  return [...map.values()];
}

export function dedupeByMintAddress(rows: any[]) {
  const map = new Map<string, any>();

  for (const r of rows) {
    map.set(r.mint_address, r); // last write wins
  }

  return [...map.values()];
}

const RPC_URL = process.env.SOLANA_RPC!;
// console.log("RPC url: ", RPC_URL);
const TREASURY_SECRET = JSON.parse(process.env.TREASURY_PRIVATE_KEY!);
// console.log("TREASURY_SECRET: ", TREASURY_SECRET);

const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(TREASURY_SECRET)
);
export async function sendSolFromTreasury(
  to: string,
  lamports: number,
): Promise<string> {
  if (lamports <= 0) {
    throw new Error("Invalid lamports amount");
  }

  const connection = new Connection(RPC_URL, "confirmed");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: TREASURY_KEYPAIR.publicKey,
      toPubkey: new PublicKey(to),
      lamports,
    }),
  );

  const sig = await connection.sendTransaction(tx, [TREASURY_KEYPAIR], {
    skipPreflight: false,
  });

  await connection.confirmTransaction(sig, "confirmed");

  return sig;
}

export const toBigIntSafe = (v: any) =>
  v === null || v === undefined ? null : Math.floor(Number(v));

export const toDecimalSafe = (v: any) =>
  v === null || v === undefined ? null : Number(v);



