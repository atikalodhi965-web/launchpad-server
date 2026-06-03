// ==== File: server/src/workers/discoveryWorker.ts ====

// TL;DR above. See plan in the assistant message.

import cron from "node-cron";
import axios from "axios";
import knex from "../db/knex";
import { redisClient } from "../redis/redisClient";
import {
  BLUECHIP_MEMES_QUERY,
  xSTOCK_TOKENS_QUERY,
  VERIFIED_LSTS_QUERY,
  AI_TOKENS_QUERY,
  TRENDING_TOKENS_QUERY,
  POPULAR_TOKENS_QUERY,
  COMBINED_TOKEN_METRICS,
  ALMOST_BONDED_QUERY,
  GET_MIGRATED_TOKENS_QUERY,
  NEWLY_CREATED_TOKENS_QUERY,
  metadataQuery,
  GET_TOKEN_OHLC_QUERY,
  GET_MULTI_TOKENCHART_OHLAC_DATA,
  BATCH_GET_TOTAL_SUPPLY_OF_TOKEN,
  GET_CURRENT_PRICE_OFTOKE_IN_BATCH,
  GET_TOP_HOLDERS_QUERY,
  MULTIPLE_CHECK_LAST_HOURS,
} from "../queries/allQueryFile";
// import { sanitizeString } from "../services/bitQueryService";
import { computeLiquidityUSD, dedupeByMintAddress, dedupeByMintCategory, getMarketMetricsBatch, getTokenBondingInfo, getTokenHolderStats, getTokenLiquidity, getTokenTradeStats, toBigIntSafe, toDecimalSafe } from "../utils/tokenRelatedUtils";
import {
  decodeMetadataBatch,
  Metadata,
  getCreationTimeAndSupplyBatch,
} from "../utils/tokenRelatedUtils"; // assume both exports exist here
// import { createPortfolioSnapshot } from "../controllers/pnlController";
import { getCollectInstructionDataSerializer } from "@metaplex-foundation/mpl-core";
import { WebSocketService } from "../service/websocketService";

// ====================== Config ======================
const BITQUERY_URL = process.env.BITQUERY_URL || "https://streaming.bitquery.io/eap";
const BITQUERY_AUTH_TOKEN = process.env.BITQUERY_AUTH_TOKEN || "ory_at_GVB4S_JW4KylmKz9phcNf8Lfw-nAvnIldmu9y_rbERA.UwC3hBBwTFKIONUHtTZQum1WiAMsP8VCYZFkRD-sXxU";
// console.log("bitquery outh token: ", BITQUERY_AUTH_TOKEN);
const REDIS_TTL = Number(process.env.DISCOVERY_CACHE_TTL ?? 120);
// const DETAIL_BATCH_SIZE = Number(process.env.DETAIL_BATCH_SIZE ?? 5);
const DB_BATCH_SIZE = Number(process.env.DB_BATCH_SIZE ?? 100); // amount per batch insert
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------
   Helpers
------------------------ */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function nowISO() {
  return new Date().toISOString();
}

/* ========================
   fetchTokenDetailBatch
   (unchanged, keeps analytics enrichment)
   ======================== */
// export async function fetchTokenDetailBatch(tokens: any[]): Promise<any[]> {
//   for (let i = 0; i < tokens.length; i += DETAIL_BATCH_SIZE) {
//     const batch = tokens.slice(i, i + DETAIL_BATCH_SIZE);
//     const mintAddresses = batch.map((t) => t.mint);

//     try {
//       const res = await axios.post(
//         BITQUERY_URL,
//         {
//           query: COMBINED_TOKEN_METRICS,
//           variables: { mintAddresses },
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//           timeout: 60_000,
//         }
//       );

//       const solanaData = res.data?.data?.Solana;
//       if (!solanaData) {
//         await sleep(250);
//         continue;
//       }

//       // --------------------------------------------------
//       // Fetch volume + trade stats (batch)
//       // --------------------------------------------------
//       const tradeStats = await getTokenTradeStats(mintAddresses);

//       // --------------------------------------------------
//       // Fetch liquidity (batch)
//       // --------------------------------------------------
//       const liquidityByMint = await getTokenLiquidity(mintAddresses);

//       for (const tok of batch) {
//         const mint = tok.mint;

//         const supplyUpdate = solanaData.TokenSupplyUpdates?.find(
//           (u: any) => u.TokenSupplyUpdate?.Currency?.MintAddress === mint
//         )?.TokenSupplyUpdate;

//         const decimals =
//           supplyUpdate?.Currency?.Decimals ??
//           solanaData.PriceMetrics?.find(
//             (p: any) => p.Trade?.Currency?.MintAddress === mint
//           )?.Trade?.Currency?.Decimals ??
//           null;

//         const latestPrice = solanaData.PriceMetrics?.find(
//           (p: any) => p.Trade?.Currency?.MintAddress === mint
//         )?.Trade?.PriceInUSD;

//         let marketcap: number | null = null;
//         if ((supplyUpdate?.PostBalanceInUSD ?? 0) > 0) {
//           marketcap = supplyUpdate.PostBalanceInUSD;
//         } else if (supplyUpdate?.PostBalance && latestPrice) {
//           marketcap = Number(supplyUpdate.PostBalance) * Number(latestPrice);
//         }

//         const priceChangeEntry = solanaData.PriceChange24h?.find(
//           (pc: any) => pc.Trade?.Currency?.MintAddress === mint
//         );
//         const priceChange24h = priceChangeEntry?.PriceChange24hPercent ?? null;

//         // const volumeEntry = solanaData.VolumeMetrics?.find(
//         //   (v: any) => v.Trade?.Currency?.MintAddress === mint
//         // );
//         // const volume1h = volumeEntry?.volume_usd_1h ? Number(volumeEntry.volume_usd_1h) : null;

//         // const liquidityEntry = solanaData.LiquidityMetrics?.find(
//         //   (l: any) => l.Pool?.Market?.BaseCurrency?.MintAddress === mint
//         // );
//         // const liquidityUSD = liquidityEntry ? computeLiquidityUSD(liquidityEntry.Pool) : null;

//         tok.marketcap = marketcap;
//         tok.price_change_24h = priceChange24h;
//         tok.decimals = decimals;
//         tok.price_usd = latestPrice ?? null;
//         // ---------- Volume (24h) ----------
//         tok.volume_usd_24h =
//           tradeStats.volumeUsd24h[mint] ?? 0;

//         // ---------- Liquidity ----------
//         tok.liquidity_usd =
//           liquidityByMint[mint] ?? 0;
//         // tok.volume_24h = volume1h;
//         // tok.liquidity = liquidityUSD;
//       }
//     } catch (err: any) {
//       console.warn("⚠️ fetchTokenDetailBatch failed:", err.message);
//     }

//     // small pause between batches
//     await sleep(500);
//   }

//   return tokens;
// }

// export async function fetchLaunchpadDetailBatch(
//   tokens: any[]
// ): Promise<any[]> {
//   for (let i = 0; i < tokens.length; i += DETAIL_BATCH_SIZE) {
//     const batch = tokens.slice(i, i + DETAIL_BATCH_SIZE);
//     const mintAddresses = batch.map((t) => t.mint);

//     try {
//       // --------------------------------------------------
//       // 1️⃣ Fetch Combined Metrics (Marketcap + Price Change)
//       // --------------------------------------------------
//       const res = await axios.post(
//         BITQUERY_URL,
//         {
//           query: COMBINED_TOKEN_METRICS,
//           variables: { mintAddresses },
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//           timeout: 60_000,
//         }
//       );

//       const solanaData = res.data?.data?.Solana;
//       if (!solanaData) {
//         await sleep(250);
//         continue;
//       }

//       // --------------------------------------------------
//       // 1.5️⃣ Fetch Liquidity (batch) ✅ NEW
//       // --------------------------------------------------
//       const liquidityByMint = await getTokenLiquidity(mintAddresses);
//       // --------------------------------------------------
//       // 2️⃣ Fetch Holder Stats (batch)
//       // --------------------------------------------------
//       const holderStats = await getTokenHolderStats(mintAddresses);

//       // --------------------------------------------------
//       // 3️⃣ Fetch Trade Stats (batch)
//       // --------------------------------------------------
//       const tradeStats = await getTokenTradeStats(mintAddresses);

//       // --------------------------------------------------
//       // 4️⃣ Fetch Bonding Curve Info (batch) ✅ NEW
//       // --------------------------------------------------
//       const tokensNeedingBonding = batch.filter(
//         (t) => t.bonding_curve_progress == null
//       );

//       let bondingInfo: any[] = [];

//       if (tokensNeedingBonding.length > 0) {
//         bondingInfo = await getTokenBondingInfo(
//           tokensNeedingBonding.map((t) => t.mint)
//         );
//       }

//       const bondingMap = new Map(
//         bondingInfo.map((b) => [b.mintAddress, b])
//       );

//       // --------------------------------------------------
//       // 5️⃣ Merge everything per token
//       // --------------------------------------------------
//       for (const tok of batch) {
//         const mint = tok.mint;

//         // ---------- Market Cap ----------
//         const supplyUpdate = solanaData.TokenSupplyUpdates?.find(
//           (u: any) =>
//             u.TokenSupplyUpdate?.Currency?.MintAddress === mint
//         )?.TokenSupplyUpdate;

//         const decimals =
//           supplyUpdate?.Currency?.Decimals ??
//           solanaData.PriceMetrics?.find(
//             (p: any) =>
//               p.Trade?.Currency?.MintAddress === mint
//           )?.Trade?.Currency?.Decimals ??
//           null;

//         const latestPrice = solanaData.PriceMetrics?.find(
//           (p: any) =>
//             p.Trade?.Currency?.MintAddress === mint
//         )?.Trade?.PriceInUSD;

//         let marketcap: number | null = null;

//         if ((supplyUpdate?.PostBalanceInUSD ?? 0) > 0) {
//           marketcap = Number(supplyUpdate.PostBalanceInUSD);
//         } else if (supplyUpdate?.PostBalance && latestPrice) {
//           marketcap =
//             Number(supplyUpdate.PostBalance) *
//             Number(latestPrice);
//         }

//         // ---------- Price Change ----------
//         const priceChangeEntry =
//           solanaData.PriceChange24h?.find(
//             (pc: any) =>
//               pc.Trade?.Currency?.MintAddress === mint
//           );

//         tok.marketcap = marketcap;
//         tok.price_change_24h =
//           priceChangeEntry?.PriceChange24hPercent ?? null;

//         tok.decimals = decimals;

//         // ---------- Liquidity ---------- ✅ NEW
//         tok.liquidity_usd = liquidityByMint[mint] ?? 0;

//         // ---------- Holder stats ----------
//         tok.holder_count =
//           holderStats.holderCount[mint] ?? 0;

//         tok.top10_holding_percent =
//           holderStats.top10HoldingPercent[mint] ?? 0;

//         tok.sniper_holding_percent =
//           holderStats.sniperHoldingPercent[mint] ?? 0;

//         // ---------- Trade stats ----------
//         tok.total_trades =
//           tradeStats.totalTrades[mint] ?? 0;

//         tok.buy_trades =
//           tradeStats.buyTrades[mint] ?? 0;

//         tok.sell_trades =
//           tradeStats.sellTrades[mint] ?? 0;

//         tok.volume_usd_24h =
//           tradeStats.volumeUsd24h[mint] ?? 0;

//         tok.buy_volume_usd =
//           tradeStats.buyVolumeUsd[mint] ?? 0;

//         tok.sell_volume_usd =
//           tradeStats.sellVolumeUsd[mint] ?? 0;
//         tok.price_usd = latestPrice ?? null;
//         // ---------- Bonding curve info ✅ NEW ----------
//         const b = bondingMap.get(mint);

//         tok.bonding_curve_progress =
//           tok.bonding_curve_progress ??
//           b?.bondingCurveProgress ??
//           null;

//         tok.protocol_family =
//           tok.protocol_family ??
//           b?.protocolFamily ??
//           null;

//         // tok.bonding_curve_created_on =
//         //   b?.creationTime ?? null;
//       }
//     } catch (err: any) {
//       console.warn(
//         "⚠️ fetchTokenDetailBatch failed:",
//         err.message
//       );
//     }

//     await sleep(500);
//   }

//   return tokens;
// }




/* =========================
   saveTokens - new behavior
   - always upsert to discovery_tokens
   - upsert to tokens ONLY when created_on && total_supply exist
   - B3 semantics: on update, only non-null incoming values overwrite existing
   ========================= */
// async function saveTokens(tokens: any[], category: string, redisKey: string) {
//   if (!tokens || tokens.length === 0) return;

//   // Step 1: Basic normalization
//   tokens = tokens.map((t) => ({
//     mint: t.mint,
//     name: t.name ?? null,
//     symbol: t.symbol ?? null,
//     uri: t.uri ?? null,
//     decimals: t.decimals ?? 0,
//     image: t.image ?? null,
//     marketcap: t.marketcap ?? null,
//     price_change_24h: t.price_change_24h ?? null,
//     price_usd: t.price_usd,
//     volume_24h: t.volume_24h ?? null,
//     liquidity: t.liquidity ?? null,
//     updated_at: new Date(),
//   }));

//   // Step 2: Decode metadata in batch
//   const uris = tokens.map((t) => t.uri);
//   let metadatas: (Metadata | null)[] = [];
//   try {
//     metadatas = await decodeMetadataBatch(uris);
//   } catch (err: any) {
//     console.warn("⚠️ decodeMetadataBatch error:", err.message);
//     metadatas = tokens.map(() => null);
//   }

//   tokens.forEach((t, i) => {
//     const meta = metadatas[i] ?? null;
//     if (meta) {
//       if (meta.image) t.image = meta.image;
//       t.description = meta.description ?? null;

//       const socials: Record<string, string> = {};
//       if (meta.twitter) socials.twitter = meta.twitter;
//       if (meta.telegram) socials.telegram = meta.telegram;
//       if (meta.website) socials.website = meta.website;

//       t.socials = Object.keys(socials).length ? socials : null;
//       t.metadata_created_on = meta.createdOn ?? null;
//     } else {
//       t.description = null;
//       t.socials = null;
//       t.metadata_created_on = null;
//     }
//   });

//   // Step 3: Fetch creation time + supply in batch
//   const mintAddresses = tokens.map((t) => t.mint);
//   let creationSupplyMap: Record<string, { created_on: string | null; total_supply: number | null }> = {};

//   try {
//     creationSupplyMap = await getCreationTimeAndSupplyBatch(mintAddresses);
//   } catch (err: any) {
//     console.error("❌ getCreationTimeAndSupplyBatch error:", err.message);
//   }

//   // Step 4: Build DB rows
//   const discoveryRows: any[] = [];
//   const tokensRows: any[] = [];

//   for (const t of tokens) {
//     const cs = creationSupplyMap[t.mint] ?? { created_on: null, total_supply: null };

//     // Always push discovery row
//     discoveryRows.push({
//       mint: t.mint,
//       category,
//       name: t.name,
//       symbol: t.symbol,
//       uri: t.uri,
//       image: t.image,
//       marketcap: t.marketcap,
//       price_change_24h: t.price_change_24h,
//       price_usd: t.price_usd,
//       volume_24h: t.volume_24h,
//       liquidity: t.liquidity,
//       updated_at: new Date(),
//     });

//     // NEW LOGIC: Always push token row
//     tokensRows.push({
//       mint_address: t.mint,
//       name: t.name ?? "Unknown",
//       symbol: t.symbol ?? "UNKNOWN",
//       image: t.image ?? null,
//       decimals: t.decimals,
//       uri: t.uri ?? null,
//       description: t.description ?? null,
//       socials: t.socials ?? {},
//       total_supply: cs.total_supply ?? null,          // allow null
//       created_on: cs.created_on ?? null,              // allow null
//       last_updated: new Date(),
//     });
//   }

//   // Step 5: DB writes in transaction
//   const trx = await knex.transaction();
//   try {
//     // discovery_tokens upserts
//     const discoveryChunks = chunkArray(discoveryRows, DB_BATCH_SIZE);
//     for (const chunk of discoveryChunks) {
//       await trx("discovery_tokens")
//         .insert(chunk)
//         .onConflict(["mint", "category"])
//         .merge({
//           name: trx.raw("EXCLUDED.name"),
//           symbol: trx.raw("EXCLUDED.symbol"),
//           uri: trx.raw("EXCLUDED.uri"),
//           image: trx.raw("EXCLUDED.image"),
//           marketcap: trx.raw("EXCLUDED.marketcap"),
//           price_change_24h: trx.raw("EXCLUDED.price_change_24h"),
//           price_usd: trx.raw("EXCLUDED.price_usd"),
//           volume_24h: trx.raw("EXCLUDED.volume_24h"),
//           liquidity: trx.raw("EXCLUDED.liquidity"),
//           updated_at: trx.raw("EXCLUDED.updated_at"),
//         });
//     }

//     // tokens upsert (now includes ALL tokens)
//     if (tokensRows.length) {
//       const tokenChunks = chunkArray(tokensRows, DB_BATCH_SIZE);

//       for (const chunk of tokenChunks) {
//         const columns = [
//           "mint_address",
//           "name",
//           "symbol",
//           "decimals",
//           "image",
//           "uri",
//           "description",
//           "socials",
//           "total_supply",
//           "created_on",
//           "last_updated",
//         ];

//         const valuesSql: string[] = [];
//         const bindings: any[] = [];

//         for (const row of chunk) {
//           valuesSql.push(`(${columns.map(() => "?").join(",")})`);
//           bindings.push(
//             row.mint_address,
//             row.name,
//             row.symbol,
//             row.decimals,
//             row.image,
//             row.uri,
//             row.description,
//             JSON.stringify(row.socials ?? {}),
//             row.total_supply,
//             row.created_on,
//             row.last_updated
//           );
//         }

//         const insertSql = `
//           INSERT INTO tokens (${columns.join(",")})
//           VALUES ${valuesSql.join(",")}
//           ON CONFLICT (mint_address) DO UPDATE SET
//             name = EXCLUDED.name,
//             symbol = EXCLUDED.symbol,
//             image = COALESCE(EXCLUDED.image, tokens.image),
//             uri = COALESCE(EXCLUDED.uri, tokens.uri),
//             decimals = EXCLUDED.decimals,
//             description = COALESCE(EXCLUDED.description, tokens.description),
//             socials = CASE
//               WHEN COALESCE(EXCLUDED.socials::text, '') <> '{}' THEN EXCLUDED.socials
//               ELSE tokens.socials
//             END,
//             total_supply = EXCLUDED.total_supply,
//             created_on = EXCLUDED.created_on,
//             last_updated = NOW()
//         `;

//         await trx.raw(insertSql, bindings);
//       }
//     }

//     await trx.commit();
//   } catch (err: any) {
//     await trx.rollback();
//     console.error("❌ DB save error:", category, err.message);
//   }

//   // Step 6: Cache
//   try {
//     await redisClient.set(redisKey, JSON.stringify(tokens), { EX: REDIS_TTL });
//   } catch (err: any) {
//     console.error("❌ Redis error:", err.message);
//   }
// }


/// ======================================================
// MAIN UPSERT FOR LAUNCHPAD + TOKENS + TOKEN_STATS
// ======================================================
// export async function saveLaunchpadTokens(
//   tokens: any[],
//   category: string,
//   redisKey: string
// ) {
//   if (!tokens || !tokens.length) return;

//   // --------------------------------------------------
//   // Normalize tokens
//   // --------------------------------------------------
//   tokens = tokens.map((t) => ({
//     mint: t.mint,
//     category,
//     decimals: t.decimals ?? 0,
//     name: t.name ?? null,
//     symbol: t.symbol ?? null,
//     uri: t.uri ?? null,
//     image: t.image ?? null,

//     marketcap: t.marketcap ?? null,
//     price_change_24h: t.price_change_24h ?? null,
//     price_usd: t.price_usd ?? null,
//     liquidity: t.liquidity_usd ?? null,
//     holders: t.holder_count ?? null,
//     txns: t.total_trades ?? null,
//     buy_trades: t.buy_trades ?? null,
//     sell_trades: t.sell_trades ?? null,
//     volume: t.volume_usd_24h ?? null,

//     buy_volume: t.buy_volume_usd ?? null,
//     sell_volume: t.sell_volume_usd ?? null,

//     holding_top_10: t.top10_holding_percent ?? null,
//     holding_snipers: t.sniper_holding_percent ?? null,

//     // ✅ NEW
//     bonding_curve_progress: t.bonding_curve_progress ?? null,
//     protocol_family: t.protocol_family ?? null,
//     // bonding_curve_created_on: t.bonding_curve_created_on ?? null,

//     time: t.bonding_curve_created_on ?? null,
//     updated_at: new Date(),
//   }));

//   // --------------------------------------------------
//   // Metadata decode (unchanged)
//   // --------------------------------------------------
//   let metas: any[] = [];
//   try {
//     metas = await decodeMetadataBatch(tokens.map((t) => t.uri));
//   } catch {
//     metas = tokens.map(() => null);
//   }

//   tokens.forEach((t, i) => {
//     const m = metas[i];
//     if (!m) return;

//     t.image = m.image ?? t.image;
//     t.social_twitter = m.twitter ?? null;
//     t.social_telegram = m.telegram ?? null;
//     t.social_website = m.website ?? null;
//     t.social_tiktok = m.tiktok ?? null;
//   });

//   // --------------------------------------------------
//   // Creation time / supply batch (unchanged)
//   // --------------------------------------------------
//   let supplyData: Record<string, any> = {};
//   try {
//     supplyData = await getCreationTimeAndSupplyBatch(
//       tokens.map((t) => t.mint)
//     );
//   } catch {
//     supplyData = {};
//   }

//   // --------------------------------------------------
//   // Build DB rows
//   // --------------------------------------------------
//   const launchpadRows: any[] = [];
//   const tokensRows: any[] = [];
//   const tokenStatsRows: any[] = [];

//   for (const t of tokens) {
//     const cs = supplyData[t.mint] ?? {};

//     launchpadRows.push({
//       mint: t.mint,
//       category,
//       name: t.name,
//       symbol: t.symbol,
//       uri: t.uri,
//       image: t.image,
//       time: t.time,

//       social_twitter: t.social_twitter,
//       social_telegram: t.social_telegram,
//       social_website: t.social_website,

//       marketcap: toDecimalSafe(t.marketcap),
//       price_usd: toDecimalSafe(t.price_usd),
//       volume: toDecimalSafe(t.volume),

//       holders: toBigIntSafe(t.holders),
//       txns: toBigIntSafe(t.txns),

//       holding_top_10: toDecimalSafe(t.holding_top_10),
//       holding_snipers: toDecimalSafe(t.holding_snipers),

//       // ✅ NEW DB FIELDS
//       bonding_curve_progress: toDecimalSafe(
//         t.bonding_curve_progress
//       ),
//       protocol_family: t.protocol_family,
//       // bonding_curve_created_on:
//       //   t.bonding_curve_created_on,

//       updated_at: new Date(),
//     });

//     tokensRows.push({
//       mint_address: t.mint,
//       name: t.name,
//       symbol: t.symbol,
//       decimals: t.decimals,
//       uri: t.uri,
//       image: t.image,
//       description: null,
//       socials: {
//         twitter: t.social_twitter,
//         telegram: t.social_telegram,
//         website: t.social_website,
//       },
//       total_supply: cs.total_supply ?? null,
//       created_on: cs.created_on ?? null,
//       last_updated: new Date(),
//     });

//     tokenStatsRows.push({
//       token_mint: t.mint,

//       market_cap: toDecimalSafe(t.marketcap),
//       volume_24h: toDecimalSafe(t.volume),
//       price_usd: toDecimalSafe(t.price_usd),
//       holders_count: toBigIntSafe(t.holders),
//       tx_count: toBigIntSafe(t.txns),

//       total_supply: toBigIntSafe(cs.total_supply),
//       created_on: cs.created_on ?? null,

//       price_change_24h: toDecimalSafe(t.price_change_24h),
//       liquidity: toDecimalSafe(t.liquidity), // ✅ NEW
//       buy_volume: toDecimalSafe(t.buy_volume),
//       sell_volume: toDecimalSafe(t.sell_volume),
//       num_buys: toBigIntSafe(t.buy_trades),
//       num_sells: toBigIntSafe(t.sell_trades),

//       "top_10_holders_%": toDecimalSafe(t.holding_top_10),
//       holding_snipers: toDecimalSafe(t.holding_snipers),

//       fetched_at: new Date(),
//     });
//   }

//   // --------------------------------------------------
//   // DB UPSERTS (unchanged)
//   // --------------------------------------------------
//   const trx = await knex.transaction();

//   try {
//     const dedupedLaunchpadRows =
//       dedupeByMintCategory(launchpadRows);

//     if (launchpadRows.length !== dedupedLaunchpadRows.length) {
//       console.warn(
//         `⚠️ launchpad deduped: ${launchpadRows.length - dedupedLaunchpadRows.length
//         } duplicates removed`
//       );
//     }
//     for (const ch of chunkArray(dedupedLaunchpadRows, 100)) {
//       await trx("launchpad_tokens")
//         .insert(ch)
//         .onConflict(["mint", "category"])
//         .merge();
//     }

//     const dedupedTokensRows = dedupeByMintAddress(tokensRows);

//     if (tokensRows.length !== dedupedTokensRows.length) {
//       console.warn(
//         `⚠️ tokens deduped: ${tokensRows.length - dedupedTokensRows.length
//         } duplicates removed`
//       );
//     }
//     for (const ch of chunkArray(dedupedTokensRows, 100)) {
//       await trx("tokens")
//         .insert(ch)
//         .onConflict("mint_address")
//         .merge();
//     }

//     for (const ch of chunkArray(tokenStatsRows, 100)) {
//       await trx("token_stats")
//         .insert(ch)
//         .onConflict("token_mint")
//         .merge({
//           market_cap: trx.raw("excluded.market_cap"),
//           volume_24h: trx.raw("excluded.volume_24h"),
//           holders_count: trx.raw("excluded.holders_count"),
//           tx_count: trx.raw("excluded.tx_count"),

//           // do NOT overwrite existing supply with NULL
//           total_supply: trx.raw(
//             "COALESCE(excluded.total_supply, token_stats.total_supply)"
//           ),

//           created_on: trx.raw(
//             "COALESCE(excluded.created_on, token_stats.created_on)"
//           ),

//           price_change_24h: trx.raw("excluded.price_change_24h"),
//           liquidity: trx.raw("excluded.liquidity"),
//           buy_volume: trx.raw("excluded.buy_volume"),
//           sell_volume: trx.raw("excluded.sell_volume"),
//           num_buys: trx.raw("excluded.num_buys"),
//           num_sells: trx.raw("excluded.num_sells"),

//           "top_10_holders_%": trx.raw(`excluded."top_10_holders_%"`),
//           holding_snipers: trx.raw("excluded.holding_snipers"),

//           fetched_at: trx.raw("excluded.fetched_at"),
//         });
//     }


//     await trx.commit();
//   } catch (err) {
//     await trx.rollback();
//     console.error("❌ saveLaunchpadTokens failed:", err);
//   }

//   // --------------------------------------------------
//   // Redis cache
//   // --------------------------------------------------
//   try {
//     await redisClient.set(redisKey, JSON.stringify(tokens), {
//       EX: 120,
//     });
//   } catch { }
// }

// ======================================================
// WORKER FETCHERS (3 new ones)
// ======================================================

// ---------- ALMOST BONDED ----------
// ---------- ALMOST BONDED ----------
// async function fetchAlmostBondedNow() {
//   console.log("🔄 Fetching Almost Bonded Tokens...");

//   try {
//     const res = await axios.post(
//       BITQUERY_URL,
//       { query: ALMOST_BONDED_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//         timeout: 120_000,
//       }
//     );

//     const pools = res.data?.data?.Solana?.DEXPools ?? [];
//     const tokens: any[] = [];

//     for (const p of pools) {
//       const base = p?.Pool?.Market?.BaseCurrency ?? {};
//       const mint = base.MintAddress;
//       if (!mint) continue;

//       tokens.push({
//         mint,
//         name: base.Name ?? null,
//         symbol: base.Symbol ?? null,
//         uri: base.Uri ?? null,
//         bondingProgress: p.Bonding_Curve_Progress_Percentage ?? null,
//         protocolFamily: p?.Pool?.Dex?.ProtocolFamily ?? null,
//       });
//     }

//     // Apply bonding filter (65%–97%)
//     const filtered = tokens.filter(
//       (t) => t.bondingProgress >= 65 && t.bondingProgress <= 97
//     );

//     await fetchLaunchpadDetailBatch(filtered);
//     await saveLaunchpadTokens(filtered, "almost_bonded", "launchpad-almost-bonded");

//     console.log(`✅ Saved ${filtered.length} almost bonded tokens`);

//   } catch (err: any) {
//     console.error("❌ fetchAlmostBondedNow error:", err.message);
//   }
// }
// ---------- MIGRATED ----------
// async function fetchMigratedNow() {
//   console.log("🔄 Fetching Migrated Tokens...");

//   const TOKEN_PROGRAM_ID =
//     "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

//   try {
//     // 1️⃣ Fetch migrated instructions
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: GET_MIGRATED_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//         timeout: 120_000,
//       }
//     );

//     const instructions =
//       response.data?.data?.Solana?.Instructions ?? [];

//     // 2️⃣ Extract migrated mints (ROUTE LOGIC)
//     const mintMethodMap = new Map<string, string>();

//     for (const instr of instructions) {
//       const method =
//         instr?.Instruction?.Program?.Method ?? "";
//       const accounts =
//         instr?.Instruction?.Accounts ?? [];

//       const candidates = accounts.filter(
//         (acc: any) =>
//           acc?.Token?.Mint &&
//           acc?.Token?.Owner === TOKEN_PROGRAM_ID &&
//           acc?.Token?.ProgramId === TOKEN_PROGRAM_ID
//       );

//       if (!candidates.length) continue;

//       const mint =
//         method === "migrate_meteora_damm"
//           ? candidates[1]?.Token?.Mint ||
//           candidates[0]?.Token?.Mint
//           : candidates[0]?.Token?.Mint;

//       if (!mint) continue;

//       mintMethodMap.set(mint, method);
//     }

//     const mintAddresses = [...mintMethodMap.keys()];
//     console.log(" mint addresses: ", mintAddresses[3], mintAddresses.length);
//     if (!mintAddresses.length) {
//       console.log("⚠️ No migrated tokens found");
//       return;
//     }

//     // 3️⃣ BATCH metadataQuery (THIS WAS THE MISSING STEP)
//     const metaResponse = await axios.post(
//       BITQUERY_URL,
//       {
//         query: metadataQuery,
//         variables: { mintAddresses },
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//         timeout: 60_000,
//       }
//     );

//     const pools =
//       metaResponse.data?.data?.Solana?.DEXPools ?? [];

//     // 4️⃣ Build mint → metadata map
//     const metaMap = new Map<string, any>();

//     for (const p of pools) {
//       const base =
//         p?.Pool?.Market?.BaseCurrency;

//       if (!base?.MintAddress || !base?.Name) continue;

//       metaMap.set(base.MintAddress, {
//         name: base.Name,
//         symbol: base.Symbol ?? null,
//         uri: base.Uri ?? null,
//       });
//     }

//     // 5️⃣ Build final tokens (NO NULL NAME)
//     const tokens: any[] = [];

//     for (const mint of mintAddresses) {
//       const meta = metaMap.get(mint);
//       if (!meta) continue;

//       tokens.push({
//         mint,
//         name: meta.name,
//         symbol: meta.symbol,
//         uri: meta.uri,
//         method: mintMethodMap.get(mint),
//       });
//     }

//     if (!tokens.length) {
//       console.log("⚠️ No hydrated migrated tokens");
//       return;
//     }

//     // 6️⃣ Continue normal pipeline
//     await fetchLaunchpadDetailBatch(tokens);
//     await saveLaunchpadTokens(
//       tokens,
//       "migrated",
//       "launchpad-migrated"
//     );

//     console.log(`✅ Saved ${tokens.length} migrated tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchMigratedNow error:", err.message);
//   }
// }
// ---------- NEWLY CREATED ----------
// async function fetchNewlyCreatedNow() {
//   console.log("🔄 Fetching Newly Created Tokens...");

//   try {
//     const res = await axios.post(
//       BITQUERY_URL,
//       { query: NEWLY_CREATED_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//         timeout: 120_000,
//       }
//     );

//     const instr = res.data?.data?.Solana?.Instructions ?? [];
//     const list: any[] = [];

//     for (const i of instr) {
//       const accounts = i.Instruction?.Accounts ?? [];
//       const mintAcc = accounts.find((a: any) => a?.Token?.Mint);
//       const mint = mintAcc?.Token?.Mint;
//       if (!mint) continue;

//       const arg = i.Instruction?.Program?.Arguments?.find(
//         (a: any) => a.Name === "createMetadataAccountArgsV3"
//       );

//       let metaData = null;
//       try {
//         metaData = arg?.Value?.json ? JSON.parse(arg.Value.json) : null;
//       } catch { }

//       const data = metaData?.data ?? {};

//       list.push({
//         mint,
//         name: data?.name ?? null,
//         symbol: data?.symbol ?? null,
//         uri: data?.uri ?? null,
//       });
//     }

//     // console.log("list of newly created tokens: ", list);
//     await fetchLaunchpadDetailBatch(list);
//     // console.log("list1: ", list[1]);
//     // console.log("list2: ", list[2]);
//     // console.log("list3: ", list[3]);
//     await saveLaunchpadTokens(list, "newly_created", "launchpad-newly-created");
//     // console.log("list3: ", list[3]);
//     // console.log("list2: ", list[2]);

//     console.log(`✅ Saved ${list.length} newly created tokens`);

//   } catch (err: any) {
//     console.error("❌ fetchNewlyCreatedNow error:", err.message);
//   }
// }
/* =========================
   Category Fetchers
   (minor changes: remove local decodeMetadata usage; rely on saveTokens)
   ========================= */

// ----------------------
// Bluechip Memes
// ----------------------
// async function fetchBluechipMemesNow() {
//   console.log("🔄 Fetching Bluechip Memes...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: BLUECHIP_MEMES_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//         timeout: 120_000,
//       }
//     );

//     const updates = response.data?.data?.Solana?.TokenSupplyUpdates ?? [];
//     const tokens: any[] = [];

//     for (const entry of updates) {
//       const update = entry.TokenSupplyUpdate ?? {};
//       const currency = update.Currency ?? {};
//       const mint = currency.MintAddress;
//       if (!mint) continue;

//       tokens.push({
//         mint,
//         name: sanitizeString(currency.Name),
//         symbol: sanitizeString(currency.Symbol),
//         uri: sanitizeString(currency.Uri),
//         image: null,
//         marketcap: update.Marketcap ?? null,
//         price_change_24h: null,
//         volume_24h: null,
//         liquidity: null,
//         updated_at: new Date(),
//       });
//     }

//     await fetchTokenDetailBatch(tokens);
//     await saveTokens(tokens, "bluechip_meme", "bluechip-memes");
//     console.log(`✅ Saved ${tokens.length} bluechip memes`);
//   } catch (err: any) {
//     console.error("❌ fetchBluechipMemesNow error:", err.message);
//   }
// }

// ----------------------
// xStock
// ----------------------
// async function fetchXStockNow() {
//   console.log("🔄 Fetching xStock tokens...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: xSTOCK_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//       }
//     );

//     const trades = response.data?.data?.Solana?.DEXTradeByTokens ?? [];
//     const seen = new Map<string, any>();
//     for (const entry of trades) {
//       const c = entry.Trade?.Currency ?? {};
//       const mint = c.MintAddress;
//       if (!mint || seen.has(mint)) continue;
//       seen.set(mint, {
//         mint,
//         name: sanitizeString(c.Name),
//         symbol: sanitizeString(c.Symbol),
//         uri: sanitizeString(c.Uri),
//         image: null,
//         marketcap: null,
//         price_change_24h: null,
//         volume_24h: null,
//         liquidity: null,
//         updated_at: new Date(),
//       });
//     }

//     const tokens = Array.from(seen.values());
//     await fetchTokenDetailBatch(tokens);
//     await saveTokens(tokens, "xstock", "xstock-tokens");
//     console.log(`✅ Saved ${tokens.length} xStock tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchXStockNow error:", err.message);
//   }
// }
// ----------------------
// LSTs
// ----------------------
// async function fetchLstsNow() {
//   console.log("🔄 Fetching Verified LSTs...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: VERIFIED_LSTS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//       }
//     );

//     const trades = response.data?.data?.Solana?.DEXTradeByTokens ?? [];
//     const seen = new Map<string, any>();
//     for (const entry of trades) {
//       const c = entry.Trade?.Currency ?? {};
//       const mint = c.MintAddress;
//       if (!mint || seen.has(mint)) continue;
//       seen.set(mint, {
//         mint,
//         name: sanitizeString(c.Name),
//         symbol: sanitizeString(c.Symbol),
//         uri: sanitizeString(c.Uri),
//         image: null,
//         marketcap: null,
//         price_change_24h: null,
//         volume_24h: null,
//         liquidity: null,
//         updated_at: new Date(),
//       });
//     }

//     const tokens = Array.from(seen.values());
//     await fetchTokenDetailBatch(tokens);
//     await saveTokens(tokens, "lsts", "lsts-tokens");
//     console.log(`✅ Saved ${tokens.length} LST tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchLstsNow error:", err.message);
//   }
// }
// ----------------------
// AI Tokens
// ----------------------
// async function fetchAiNow() {
//   console.log("🔄 Fetching AI tokens...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: AI_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//       }
//     );

//     const trades = response.data?.data?.Solana?.DEXTradeByTokens ?? [];
//     const seen = new Map<string, any>();
//     for (const entry of trades) {
//       const c = entry.Trade?.Currency ?? {};
//       const mint = c.MintAddress;
//       if (!mint || seen.has(mint)) continue;
//       seen.set(mint, {
//         mint,
//         name: sanitizeString(c.Name),
//         symbol: sanitizeString(c.Symbol),
//         uri: sanitizeString(c.Uri),
//         image: null,
//         marketcap: null,
//         price_change_24h: null,
//         volume_24h: null,
//         liquidity: null,
//         updated_at: new Date(),
//       });
//     }

//     const tokens = Array.from(seen.values());
//     await fetchTokenDetailBatch(tokens);
//     await saveTokens(tokens, "ai", "ai-tokens");
//     console.log(`✅ Saved ${tokens.length} AI tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchAiNow error:", err.message);
//   }
// }
// ----------------------
// Trending
// ----------------------
// async function fetchTrendingNow() {
//   console.log("🔄 Fetching Trending tokens...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: TRENDING_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//       }
//     );

//     const solana = response.data?.data?.Solana;
//     if (!solana) return;

//     const frames = [solana.trending_1min, solana.trending_5min, solana.trending_30min, solana.trending_1hour].filter(Boolean);
//     const tokenMap = new Map<string, any[]>();

//     frames.forEach((frame: any[], idx: number) => {
//       frame.forEach((entry: any) => {
//         const c = entry.Trade?.Currency;
//         if (!c?.MintAddress) return;
//         if (!tokenMap.has(c.MintAddress)) tokenMap.set(c.MintAddress, []);
//         tokenMap.get(c.MintAddress)!.push({ frameIndex: idx, uniqueTraders: entry.tradesCountWithUniqueTraders, volume: entry.traded_volume, trades: entry.trades, currency: c });
//       });
//     });

//     const trending: any[] = [];
//     const seenMints = new Set<string>();

//     for (const [mint, metrics] of tokenMap) {
//       metrics.sort((a, b) => a.frameIndex - b.frameIndex);
//       let isTrending = false;
//       for (let i = 1; i < metrics.length; i++) {
//         if (metrics[i].uniqueTraders > metrics[i - 1].uniqueTraders || metrics[i].volume > metrics[i - 1].volume || metrics[i].trades > metrics[i - 1].trades) {
//           isTrending = true;
//           break;
//         }
//       }
//       if (isTrending && !seenMints.has(mint)) {
//         seenMints.add(mint);
//         const c = metrics[0].currency;
//         trending.push({
//           mint,
//           name: sanitizeString(c.Name),
//           symbol: sanitizeString(c.Symbol),
//           uri: sanitizeString(c.Uri),
//           image: null,
//           marketcap: null,
//           price_change_24h: null,
//           volume_24h: null,
//           liquidity: null,
//           updated_at: new Date(),
//         });
//       }
//     }

//     await fetchTokenDetailBatch(trending);
//     await saveTokens(trending, "trending", "trending-tokens");
//     console.log(`✅ Saved ${trending.length} trending tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchTrendingNow error:", err.message);
//   }
// }
// ----------------------
// Popular
// ----------------------
// async function fetchPopularNow() {
//   console.log("🔄 Fetching Popular tokens...");
//   try {
//     const response = await axios.post(
//       BITQUERY_URL,
//       { query: POPULAR_TOKENS_QUERY },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//         },
//       }
//     );

//     const solana = response.data?.data?.Solana;
//     if (!solana) return;

//     const frames = [solana.popular_24h, solana.popular_7d].filter(Boolean);
//     const tokenMap = new Map<string, any[]>();

//     frames.forEach((frame: any[], idx: number) => {
//       frame.forEach((entry: any) => {
//         const c = entry.Trade?.Currency;
//         if (!c?.MintAddress) return;
//         if (!tokenMap.has(c.MintAddress)) tokenMap.set(c.MintAddress, []);
//         tokenMap.get(c.MintAddress)!.push({ frameIndex: idx, currency: c });
//       });
//     });

//     const popular: any[] = [];
//     const seenMints = new Set<string>();

//     for (const [mint, metrics] of tokenMap) {
//       metrics.sort((a, b) => a.frameIndex - b.frameIndex);
//       if (!seenMints.has(mint)) {
//         seenMints.add(mint);
//         const c = metrics[0].currency;
//         popular.push({
//           mint,
//           name: sanitizeString(c.Name),
//           symbol: sanitizeString(c.Symbol),
//           uri: sanitizeString(c.Uri),
//           image: null,
//           marketcap: null,
//           price_change_24h: null,
//           volume_24h: null,
//           liquidity: null,
//           updated_at: new Date(),
//         });
//       }
//     }

//     await fetchTokenDetailBatch(popular);
//     await saveTokens(popular, "popular", "popular-tokens");
//     console.log(`✅ Saved ${popular.length} popular tokens`);
//   } catch (err: any) {
//     console.error("❌ fetchPopularNow error:", err.message);
//   }
// }
// src/workers/fetchTokenChartNow.ts

const INTERVAL_MINUTES = 5;
const INTERVAL_LABEL = "5m";

// export async function fetchTokenChartNow() {
//   console.log("📊 fetchTokenChartNow started");

//   const tokens = await knex("tokens")
//     .where({ is_active: true })
//     .pluck("mint_address");

//   if (!tokens.length) return;
//   console.log("tokens length: ", tokens.length);

//   const tokenBatches = chunkArray(tokens, DETAIL_BATCH_SIZE);

//   for (const mintAddresses of tokenBatches) {
//     try {
//       const response = await axios.post(
//         BITQUERY_URL,
//         {
//           query: GET_MULTI_TOKENCHART_OHLAC_DATA,
//           variables: {
//             mintAddresses,
//             solMint: "So11111111111111111111111111111111111111112",
//             limit: 300,
//             intervalInMinutes: INTERVAL_MINUTES,
//           },
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//         }
//       );

//       const rows =
//         response.data?.data?.Solana?.DEXTradeByTokens ?? [];

//       if (!rows.length) continue;

//       const candleMap = new Map<string, any>();

//       for (const r of rows) {
//         const token_mint = r.Trade.Currency.MintAddress;
//         const interval = INTERVAL_LABEL;
//         const time = Math.floor(
//           new Date(r.Block.Timefield).getTime() / 1000
//         );

//         const key = `${token_mint}|${interval}|${time}`;

//         const open = Number(r.Trade.open);
//         const high = Number(r.Trade.high);
//         const low = Number(r.Trade.low);
//         const close = Number(r.Trade.close);
//         const volume = Number(r.volume);

//         if (!candleMap.has(key)) {
//           // First trade in this time bucket
//           candleMap.set(key, {
//             token_mint,
//             interval,
//             time,
//             open,
//             high,
//             low,
//             close,
//             volume,
//           });
//         } else {
//           // Merge into existing candle
//           const c = candleMap.get(key);
//           c.high = Math.max(c.high, high);
//           c.low = Math.min(c.low, low);
//           c.close = close;        // last trade wins
//           c.volume += volume;
//         }
//       }

//       const candles = Array.from(candleMap.values());


//       const dbBatches = chunkArray(candles, DB_BATCH_SIZE);

//       for (const batch of dbBatches) {
//         await knex("token_chart")
//           .insert(batch)
//           .onConflict(["token_mint", "interval", "time"])
//           .merge();
//       }

//       await sleep(300); // small pause to respect Bitquery limits
//     } catch (err: any) {
//       console.error("❌ chart batch failed:", err.message);
//     }
//   }

//   // ✅ retention: keep ~1 month (31 days)
//   const ONE_MONTH_SECONDS = 31 * 24 * 60 * 60;

//   await knex("token_chart")
//     .where(
//       "time",
//       "<",
//       Math.floor(Date.now() / 1000) - ONE_MONTH_SECONDS
//     )
//     .delete();
// }
const DETAIL_BATCH_SIZE = 20;

type ActiveTokenRow = {
  mint_address: string;
};

const BITQUERY_SAFE_BATCH = 25;


// async function runTokenStatsWorker(): Promise<void> {
//   const tokens: ActiveTokenRow[] = await knex("tokens")
//     .select("mint_address")
//     .where("is_active", true);

//   for (let i = 0; i < tokens.length; i += DETAIL_BATCH_SIZE) {
//     const batch = tokens.slice(i, i + DETAIL_BATCH_SIZE);
//     const mintAddresses = batch.map(t => t.mint_address);

//     for (let j = 0; j < mintAddresses.length; j += BITQUERY_SAFE_BATCH) {
//       const safeBatch = mintAddresses.slice(j, j + BITQUERY_SAFE_BATCH);

//       try {
//         // 🔒 Bitquery calls MUST be serialized
//         const marketMetrics = await getMarketMetricsBatch(safeBatch);
//         // console.log("market metrics price chnage 24 h: ", marketMetrics[1]);
//         await sleep(300);

//         const tradeStats = await getTokenTradeStats(safeBatch);
//         await sleep(300);

//         const holderStats = await getTokenHolderStats(safeBatch);
//         await sleep(300);

//         const creationSupply = await getCreationTimeAndSupplyBatch(safeBatch);
//         await sleep(300);

//         const liquidityByMint = await getTokenLiquidity(safeBatch);

//         const rows = safeBatch.map((mint) => ({
//           token_mint: mint,

//           market_cap: marketMetrics[mint]?.market_cap ?? null,
//           price_change_24h: marketMetrics[mint]?.price_change_24h ?? null,

//           volume_24h: tradeStats.volumeUsd24h?.[mint] ?? null,
//           buy_volume: tradeStats.buyVolumeUsd?.[mint] ?? null,
//           sell_volume: tradeStats.sellVolumeUsd?.[mint] ?? null,

//           tx_count: tradeStats.totalTrades?.[mint] ?? null,
//           num_buys: tradeStats.buyTrades?.[mint] ?? null,
//           num_sells: tradeStats.sellTrades?.[mint] ?? null,

//           liquidity: liquidityByMint[mint] ?? null,
//           holders_count: holderStats.holderCount?.[mint] ?? null,
//           "top_10_holders_%": holderStats.top10HoldingPercent?.[mint] ?? null,
//           holding_snipers: holderStats.sniperHoldingPercent?.[mint] ?? null,

//           total_supply: creationSupply[mint]?.total_supply ?? null,
//           created_on: creationSupply[mint]?.created_on ?? null,

//           fetched_at: knex.fn.now(),
//         }));

//         await knex("token_stats")
//           .insert(rows)
//           .onConflict("token_mint")
//           .merge({
//             market_cap: knex.raw("excluded.market_cap"),
//             price_change_24h: knex.raw("excluded.price_change_24h"),

//             volume_24h: knex.raw("excluded.volume_24h"),
//             buy_volume: knex.raw("excluded.buy_volume"),
//             sell_volume: knex.raw("excluded.sell_volume"),

//             tx_count: knex.raw("excluded.tx_count"),
//             num_buys: knex.raw("excluded.num_buys"),
//             num_sells: knex.raw("excluded.num_sells"),

//             liquidity: knex.raw("excluded.liquidity"),
//             holders_count: knex.raw("excluded.holders_count"),

//             "top_10_holders_%": knex.raw(`excluded."top_10_holders_%"`),
//             holding_snipers: knex.raw("excluded.holding_snipers"),

//             total_supply: knex.raw(
//               "COALESCE(excluded.total_supply, token_stats.total_supply)"
//             ),
//             created_on: knex.raw(
//               "COALESCE(excluded.created_on, token_stats.created_on)"
//             ),

//             fetched_at: knex.raw("excluded.fetched_at"),
//           });
//         console.log(`✅ stats updates successfully`);
//       } catch (err) {
//         console.error("❌ Token stats safe batch failed:", {
//           size: safeBatch.length,
//           err,
//         });
//       }
//     }
//   }
// }


// async function runTokenHoldersWorker(): Promise<void> {
//   const tokens: ActiveTokenRow[] = await knex("tokens")
//     .select("mint_address")
//     .where("is_active", true);

//   console.log("tokens lenght: ", tokens.length);
//   for (let i = 0; i < tokens.length; i += DETAIL_BATCH_SIZE) {
//     const batch = tokens.slice(i, i + DETAIL_BATCH_SIZE);
//     const mintAddresses = batch.map(t => t.mint_address);

//     try {
//       // --------------------------------------------------
//       // 1️⃣ Fetch top holders
//       // --------------------------------------------------
//       const holdersRes = await axios.post(
//         BITQUERY_URL,
//         {
//           query: GET_TOP_HOLDERS_QUERY,
//           variables: { mintAddresses },
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//           timeout: 60000,
//         }
//       );

//       const balanceUpdates =
//         holdersRes.data?.data?.Solana?.BalanceUpdates ?? [];

//       if (!balanceUpdates.length) continue;

//       // --------------------------------------------------
//       // 2️⃣ Fetch prices
//       // --------------------------------------------------
//       const priceRes = await axios.post(
//         BITQUERY_URL,
//         {
//           query: GET_CURRENT_PRICE_OFTOKE_IN_BATCH,
//           variables: { mintAddresses },
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//           timeout: 60000,
//         }
//       );

//       const priceRows =
//         priceRes.data?.data?.Solana?.PriceMetrics ?? [];

//       const priceByMint: Record<string, number> = {};
//       for (const p of priceRows) {
//         const mint = p.Trade.Currency.MintAddress;
//         const priceUsd = Number(p.Trade.PriceInUSD ?? 0);
//         priceByMint[mint] = priceUsd;
//       }

//       // --------------------------------------------------
//       // 3️⃣ Fetch total supply
//       // --------------------------------------------------
//       const supplyRes = await axios.post(
//         BITQUERY_URL,
//         {
//           query: BATCH_GET_TOTAL_SUPPLY_OF_TOKEN,
//           variables: { mintAddresses },
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//           },
//           timeout: 60000,
//         }
//       );

//       const supplyRows =
//         supplyRes.data?.data?.Solana?.TokenSupplyUpdates ?? [];

//       const supplyByMint: Record<string, number> = {};
//       for (const row of supplyRows) {
//         const mint = row.TokenSupplyUpdate.Currency.MintAddress;
//         supplyByMint[mint] = Number(row.TokenSupplyUpdate.PostBalance) || 0;
//       }

//       // --------------------------------------------------
//       // 4️⃣ Build DB rows
//       // --------------------------------------------------
//       const rows = balanceUpdates.map((row: any) => {
//         const mint = row.BalanceUpdate.Currency.MintAddress;
//         const holderAddress = row.BalanceUpdate.Account.Address;

//         const holding = Number(row.BalanceUpdate.Holding) || 0;
//         const priceUsd = priceByMint[mint] ?? 0;
//         const totalSupply = supplyByMint[mint] ?? 0;

//         const valueUsd = Number((holding * priceUsd).toFixed(8));
//         const holdingPercent =
//           totalSupply > 0
//             ? Number(((holding / totalSupply) * 100).toFixed(6))
//             : 0;

//         return {
//           token_mint: mint,
//           holder_address: holderAddress,
//           tokens_holdings: holding,
//           value_of_tokens_holdings: valueUsd,
//           holding_percent: holdingPercent,
//           fetched_at: knex.fn.now(),
//         };
//       });

//       // --------------------------------------------------
//       // 5️⃣ UPSERT (no DB load)
//       // --------------------------------------------------
//       await knex("token_holders")
//         .insert(rows)
//         .onConflict(["token_mint", "holder_address"])
//         .merge();

//       console.log(`✅ Saved alltoken holders popular tokens`);
//     } catch (err: any) {
//       console.error("❌ token holders batch failed:", err.message);
//     }
//   }
// }


// async function repairMissingMetadata(): Promise<void> {
//   console.log("🛠️ Starting metadata repair job...");

//   const BATCH_SIZE = 25;

//   /* ======================================================
//    * STEP 1A — FIX TOKENS TABLE (decode + update)
//    * ====================================================== */
//   console.log("🔍 Checking tokens table for missing image/description/socials...");

//   const tokensMissing = await knex("tokens")
//     .select("mint_address as mint", "uri")
//     .where("is_active", true)
//     .where(function () {
//       this.whereNull("image")
//         .orWhere("image", "")
//         .orWhereNull("description")
//         .orWhere("description", "");
//     });

//   console.log("➡️ Missing tokens count:", tokensMissing.length);

//   const tokenJobs = tokensMissing.filter((row) => row.uri);

//   for (let i = 0; i < tokenJobs.length; i += BATCH_SIZE) {
//     const batch = tokenJobs.slice(i, i + BATCH_SIZE);
//     const uris = batch.map((b) => b.uri);

//     console.log(
//       `🟢 Token decode batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`
//     );

//     const decoded = await decodeMetadataBatch(uris);

//     for (let j = 0; j < batch.length; j++) {
//       const req = batch[j];
//       const meta = decoded[j];
//       if (!meta) continue;

//       const socials = {
//         telegram: meta.telegram ?? null,
//         twitter: meta.twitter ?? null,
//         website: meta.website ?? null,
//       };

//       try {
//         await knex("tokens")
//           .update({
//             image: meta.image ?? null,
//             description: meta.description ?? null,
//             socials: JSON.stringify(socials),
//             last_updated: knex.fn.now(),
//           })
//           .where({ mint_address: req.mint });
//       } catch (err: any) {
//         console.error("❌ Failed to update token:", req.mint, err.message);
//       }
//     }
//   }

//   console.log("✅ Step 1A complete — Metadata decoded & stored.");


//   /* ======================================================
//    * STEP 1B — FETCH creation_time + total_supply FOR MISSING TOKENS
//    * ====================================================== */
//   console.log("⏳ Checking tokens missing created_on or total_supply...");

//   const tokensMissingCTS = await knex("tokens")
//     .select("mint_address as mint")
//     .where(function () {
//       this.whereNull("created_on")
//         .orWhereNull("total_supply");
//     });

//   console.log("➡️ Tokens missing creation time / supply:", tokensMissingCTS.length);

//   const mintList = tokensMissingCTS.map((t) => t.mint);

//   for (let i = 0; i < mintList.length; i += BATCH_SIZE) {
//     const batch = mintList.slice(i, i + BATCH_SIZE);

//     console.log(
//       `🟣 Creation/Supply batch ${i / BATCH_SIZE + 1} (${batch.length} items)...`
//     );

//     try {
//       const result = await getCreationTimeAndSupplyBatch(batch);

//       for (const mint of batch) {
//         const row = result[mint];
//         if (!row) continue;

//         await knex("tokens")
//           .update({
//             created_on: row.created_on,
//             total_supply: row.total_supply,
//             last_updated: knex.fn.now(),
//           })
//           .where({ mint_address: mint });
//       }
//     } catch (err: any) {
//       console.error("❌ Error updating creation/supply batch:", err.message);
//     }
//   }

//   console.log("✅ Step 1B complete — Created_on & total_supply updated.");


//   /* ======================================================
//    * STEP 2 — SYNC discovery_tokens USING tokens TABLE (NO DECODING)
//    * ====================================================== */
//   console.log("🔍 Checking discovery_tokens with missing images...");

//   const discoveryMissing = await knex("discovery_tokens")
//     .select("mint", "category")
//     .where(function () {
//       this.whereNull("image").orWhere("image", "");
//     });

//   console.log("➡️ discovery missing count:", discoveryMissing.length);

//   for (const row of discoveryMissing) {
//     try {
//       const tokenData = await knex("tokens")
//         .select("image")
//         .where({ mint_address: row.mint })
//         .first();

//       if (!tokenData || !tokenData.image) continue;

//       await knex("discovery_tokens")
//         .update({
//           image: tokenData.image,
//           updated_at: knex.fn.now(),
//         })
//         .where({
//           mint: row.mint,
//           category: row.category,
//         });
//     } catch (err: any) {
//       console.error(
//         "❌ Failed updating discovery token:",
//         row.mint,
//         err.message
//       );
//     }
//   }

//   console.log("🎉 ALL metadata repaired successfully.");
// }

// async function createPortfolioSnapshotsNow(): Promise<void> {
//   console.log("📸 Creating portfolio snapshots...");

//   try {
//     const users = await knex("users")
//       .where({ is_active: true })
//       .select("privy_id", "balance_usd", "pnl_usd");

//     for (const user of users) {
//       await createPortfolioSnapshot(user.privy_id);
//     }

//     console.log(`✅ Portfolio snapshots created for ${users.length} users`);
//   } catch (err: any) {
//     console.error("❌ createPortfolioSnapshotsNow error:", err.message);
//   }
// }
const ACTIVITY_BATCH_SIZE = 50;
const HOURS_WINDOWS = [24, 72, 168];

type TokenRow = {
  mint_address: string;
};

// export async function runTokenActivityWorker(): Promise<void> {
//   const tokens: TokenRow[] = await knex("tokens").select("mint_address");
//   if (!tokens.length) return;

//   for (let i = 0; i < tokens.length; i += ACTIVITY_BATCH_SIZE) {
//     const batch = tokens.slice(i, i + ACTIVITY_BATCH_SIZE);
//     const mintAddresses = batch.map(t => t.mint_address);

//     try {
//       const activeMints = new Set<string>();

//       for (const hours of HOURS_WINDOWS) {
//         const res = await axios.post(
//           BITQUERY_URL,
//           {
//             query: MULTIPLE_CHECK_LAST_HOURS,
//             variables: {
//               mintAddresses,
//               hours_ago: hours,
//             },
//           },
//           {
//             headers: {
//               Authorization: `Bearer ${BITQUERY_AUTH_TOKEN}`,
//             },
//             timeout: 60000,
//           }
//         );

//         const trades =
//           res.data?.data?.Solana?.DEXTradeByTokens ?? [];

//         for (const t of trades) {
//           const mint = t.Trade?.Currency?.MintAddress;
//           if (mint) activeMints.add(mint);
//         }
//       }

//       const activeList = [...activeMints];
//       const inactiveList = mintAddresses.filter(
//         m => !activeMints.has(m)
//       );

//       if (activeList.length) {
//         await knex("tokens")
//           .whereIn("mint_address", activeList)
//           .update({
//             is_active: true,
//             last_updated: knex.fn.now(),
//           });
//       }

//       if (inactiveList.length) {
//         await knex("tokens")
//           .whereIn("mint_address", inactiveList)
//           .update({
//             is_active: false,
//             last_updated: knex.fn.now(),
//           });
//       }

//       console.log(
//         `✅ Activity check done | active=${activeList.length} inactive=${inactiveList.length}`
//       );
//     } catch (err: any) {
//       console.error("❌ token activity batch failed:", err.message);
//     }
//   }
// }

async function withLock(
  key: string,
  ttlSeconds: number,
  job: () => Promise<void>
): Promise<boolean> {
  const lockKey = `lock:${key}`;

  const acquired = await redisClient.set(lockKey, "1", {
    NX: true,
    EX: ttlSeconds,
  });

  if (!acquired) {
    return false;
  }

  try {
    await job();
    return true;
  } catch (err) {
    console.error(`❌ ${key} failed`, err);
    throw err;
  } finally {
    await redisClient.del(lockKey);
  }
}

let running = 0;
const MAX_CONCURRENT_JOBS = 2;

async function runWithGlobalLimit(job: () => Promise<void>) {
  while (running >= MAX_CONCURRENT_JOBS) {
    await new Promise((r) => setTimeout(r, 500));
  }

  running++;
  try {
    await job();
  } finally {
    running--;
  }
}

/* ====================== Worker Scheduler ====================== */
// export function startDiscoveryWorkers() {
//   // stats: every 2 min, offset
//   // schedule("1-59/2 * * * *", "token-stats", 180, runTokenStatsWorker);

//   // // activity: every 5 min, offset 1hour
//   schedule("1-59/5 * * * *", "token-activity", 240, runTokenActivityWorker);

//   // // discovery
//   schedule("1-59/5 * * * *", "trending", 360, fetchTrendingNow);
//   schedule("1-59/8 * * * *", "popular", 360, fetchPopularNow);
//   // schedule("1-59/10 * * * *", "new-tokens", 360, fetchNewlyCreatedNow);

//   // // bonding / migration
//   // schedule("1-59/3 * * * *", "almost-bonded", 600, fetchAlmostBondedNow);
//   schedule("1-59/6 * * * *", "migrated", 600, fetchMigratedNow);

//   // // charts
//   schedule("1-59/6 * * * *", "charts", 600, fetchTokenChartNow);

//   // // holders
//   schedule("1-59/10 * * * *", "holders", 900, runTokenHoldersWorker);

//   // // long-interval discovery (40 min)
//   schedule("1-59/40 * * * *", "bluechip", 1800, fetchBluechipMemesNow);
//   schedule("1-59/40 * * * *", "xstock", 1800, fetchXStockNow);
//   schedule("1-59/40 * * * *", "ai", 1800, fetchAiNow);
//   schedule("1-59/40 * * * *", "lsts", 3600, fetchLstsNow);

//   // // maintenance (unchanged, already offset)
//   schedule("5 * * * *", "repair", 5400, repairMissingMetadata);
//   schedule("10 * * * *", "snapshot", 5400, createPortfolioSnapshotsNow);
// }


// In blueChipWorker.ts
async function updateCoinStats() {
  console.log("🔄 Updating coin stats...");

  const coins = await knex("coins").where("status", "live").pluck("mint_address");

  for (let i = 0; i < coins.length; i += DETAIL_BATCH_SIZE) {
    const batch = coins.slice(i, i + DETAIL_BATCH_SIZE);
    const mintAddresses = batch.map(m => m);

    try {
      // Fetch required data
      const marketMetrics = await getMarketMetricsBatch(mintAddresses);
      const tradeStats = await getTokenTradeStats(mintAddresses);
      const bondingInfo = await getTokenBondingInfo(mintAddresses);

      const bondingMap = new Map(
        bondingInfo.map((b) => [b.mintAddress, b])
      );

      const updates = mintAddresses.map((mint) => ({
        mint_address: mint,
        current_price: marketMetrics[mint]?.current_price ?? null,
        market_cap: marketMetrics[mint]?.market_cap ?? null,
        volume_24h: tradeStats.volumeUsd24h?.[mint] ?? null,
        price_change_24h: marketMetrics[mint]?.price_change_24h ?? null,
        bonding_progress: bondingMap.get(mint)?.bondingCurveProgress ?? null,
        ath_price: marketMetrics[mint]?.ath_price ?? null,
        ath_marketcap: marketMetrics[mint]?.ath_marketcap ?? null,
        bonding_current_amount: bondingMap.get(mint)?.bonding_current_amount ?? null,
        bonding_target_amount: bondingMap.get(mint)?.bonding_target_amount ?? null,
      }));

      // Batch update DB
      for (const update of updates) {
        await knex("coins")
          .where({ mint_address: update.mint_address })
          .update(update);
      }

      // Store in Redis (without deleting previous data)
      const redisKey = `coin_stats:${mintAddresses.join(',')}`;
      const existing = await redisClient.get(redisKey);
      const existingData = existing ? JSON.parse(existing) : {};

      const newData = { ...existingData };
      updates.forEach((update) => {
        newData[update.mint_address] = { ...newData[update.mint_address], ...update };
      });

      await redisClient.set(redisKey, JSON.stringify(newData), { EX: REDIS_TTL });

      // Broadcast realtime updates
      try {
        const wsService = WebSocketService.getInstance();
        wsService.broadcastTokenStatsUpdate(updates);
      } catch (err: any) {
        console.warn("WebSocket broadcast failed:", err.message);
      }

      console.log(`✅ Updated ${updates.length} coins`);
    } catch (err: any) {
      console.error("❌ updateCoinStats batch failed:", err.message);
    }
  }
}

// Add to scheduler
schedule("1-59/10 * * * *", "update-coin-stats", 600, updateCoinStats);


function schedule(
  cronTime: string,
  name: string,
  ttl: number,
  job: () => Promise<void>
) {
  cron.schedule(cronTime, async () => {
    const jitter = Math.floor(Math.random() * 4000);

    setTimeout(async () => {
      console.log(`🔄 ${name} tick`);

      await runWithGlobalLimit(async () => {
        const ran = await withLock(name, ttl, job);
        if (!ran) {
          console.log(`⏭️ ${name} skipped (lock active)`);
        }
      });

    }, jitter);
  });
}


// if (require.main === module) {
//   (async () => {
//     if (!redisClient.isOpen) await redisClient.connect();
//     startDiscoveryWorkers();
//   })();
// }
