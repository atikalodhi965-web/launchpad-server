import { Knex } from 'knex';
import { redisClient } from "../redis/redisClient";
import knex from '.././db/knex';
import { handleTradeCommission } from './referralService';
import { addVideoToPipeline } from '../redis/videoQueue';
import { v4 as uuidv4 } from 'uuid';
import { MeteoraDBCService } from '../service/MeteoraDBC/meteoraDBCService';
import { getConnection } from '../utils/connection';
import { 
  calculateTokenPrice, 
  calculateMarketCap, 
  calculateCirculatingSupply, 
  parseRawAmount 
} from '../utils/tokenStats';

export interface FinalizeTokenParams {
  mintAddress: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  r2Key?: string; // New field for the pipeline
  thumbnailUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tiktok?: string;
  youtube?: string;
  twitterVerified?: boolean;
  tiktokVerified?: boolean;
  creatorId: string;
  txHash: string;
  launchMode?: string;
  poolAddress?: string;
  configAddress?: string;
}

export interface FinalizeTokenResponse {
  success: boolean;
  coinId?: string;
  error?: string;
}

interface BuyParams {
  buyAmount: number;       // SOL spent
  tokensReceived: number;  // tokens received
  price: number;           // price per token
}
interface QueryParams {
  category?: 'new' | 'launching' | 'migrated' | 'movers';
  limit?: number;
  cursor?: string;
}

const REDIS_TTL = 60; // seconds

export async function finalizeTokenService(
  knexOrTrx: Knex | Knex.Transaction,
  params: FinalizeTokenParams
): Promise<FinalizeTokenResponse> {
  const isTransaction = (knexOrTrx as any).isTransaction || (knexOrTrx.constructor.name === 'Transaction');
  const trx = isTransaction ? (knexOrTrx as Knex.Transaction) : await knexOrTrx.transaction();

  try {
    const {
      mintAddress,
      name,
      symbol,
      description,
      imageUrl,
      videoUrl,
      thumbnailUrl,
      website,
      twitter,
      telegram,
      tiktok,
      youtube,
      twitterVerified,
      tiktokVerified,
      creatorId,
      txHash,
      poolAddress,
      configAddress,
    } = params;

    if (!mintAddress || !name || !symbol || !creatorId || !txHash) {
      throw new Error('Missing required fields');
    }

    const exists = await trx('coins').where({ mint_address: mintAddress }).first();
    if (exists) throw new Error('Token with this mint address already exists');

    let currentPrice = 0;
    let marketCap = 0;
    let solReserves = 0;
    let tokenReserves = 0;
    const totalSupplyValue = 1_000_000_000;

    if (poolAddress) {
      try {
        const connection = getConnection('confirmed');
        const meteoraService = new MeteoraDBCService(connection);
        const poolRes = await meteoraService.getPoolState(poolAddress);
        
        if (poolRes.success && poolRes.pool) {
          const pool = poolRes.pool;
          // Reserves are returned as hex strings without 0x in some cases
          solReserves = parseRawAmount(pool.quoteReserve);
          tokenReserves = parseRawAmount(pool.baseReserve);
          
          currentPrice = calculateTokenPrice(pool.baseReserve, pool.quoteReserve);
          
          const circulatingSupply = calculateCirculatingSupply(totalSupplyValue, pool.baseReserve);
          
          // If circulating supply is 0, it means no tokens have been bought yet.
          // Use total supply for market cap as requested.
          const noSwaps = circulatingSupply === 0;
          
          marketCap = calculateMarketCap(currentPrice, circulatingSupply, noSwaps, totalSupplyValue);
        }
      } catch (poolErr) {
        console.error('Error fetching pool state during finalization:', poolErr);
      }
    }

    // coins
    await trx('coins').insert({
      id: mintAddress,
      mint_address: mintAddress,
      name,
      symbol,
      description,
      logo_url: imageUrl,
      website_url: website,
      twitter_url: twitter,
      telegram_url: telegram,
      tiktok_url: tiktok,
      youtube_url: youtube,
      twitter_verified: !!twitterVerified,
      tiktok_verified: !!tiktokVerified,
      created_by: creatorId,
      status: 'launching',
      pool_address: poolAddress,
      config_address: configAddress,
      total_supply: totalSupplyValue,
      current_price: currentPrice,
      market_cap: marketCap,
      // tx_hash: txHash,  // Added tx_hash
    });

    // coin_media (Main record)
    await trx('coin_media').insert({
      coin_id: mintAddress,
      image_url: imageUrl,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
    });

    // coin_liquidity_pools
    if (poolAddress) {
      await trx('coin_liquidity_pools').insert({
        coin_id: mintAddress,
        sol_reserves: solReserves,
        token_reserves: tokenReserves,
      });
    }

    // coin_launch_config
    await trx('coin_launch_config').insert({
      coin_id: mintAddress,
      creator_id: creatorId,
      initial_buy_amount: 0,
      ownership_percent: 0,
      token_price: currentPrice,
      total_supply: totalSupplyValue,
    });

    // coin_creators
    await trx('coin_creators').insert({
      coin_id: mintAddress,
      creator_id: creatorId,
      is_shareable: true,
      tx_id: txHash, 
    });
    // creator_earnings
    await trx('creator_earnings').insert({
      creator_id: creatorId,
      coin_id: mintAddress,
      total_earned: 0,
      total_claimed: 0,
      unclaimed: 0,
    });
    
    if (!isTransaction) {
      await trx.commit();
    }
    
    // Clear redis cache for new tokens
    try {
      await redisClient.del('tokens:new');
      await redisClient.del('tokens:launching');
    } catch (redisError) {
      console.error('Error clearing redis cache:', redisError);
    }

    return {
      success: true,
      coinId: mintAddress,
    };
  } catch (error) {
    if (!isTransaction) {
      await trx.rollback();
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function finalizeTokenWithBuy(
  knex: Knex,
  params: FinalizeTokenParams & BuyParams
) {
  const trx = await knex.transaction();

  try {
    const {
      creatorId,
      mintAddress,
      txHash,
      buyAmount,
      tokensReceived,
      price,
    } = params;

    // validate user
    const user = await trx('users').where({ id: creatorId }).first();
    if (!user) throw new Error('User not found');

    // 1. base insert
    await finalizeTokenService(trx, params);

    // 2. insert trade
    const [trade] = await trx('trades').insert({
      user_id: creatorId,
      coin_id: mintAddress,
      type: 'buy',
      price,
      usd_value: buyAmount,
      input_amount: buyAmount,
      output_amount: tokensReceived,
      tx_hash: txHash,
    }).returning('*');

    // Handle referral commission
    await handleTradeCommission(trade.id, creatorId, buyAmount);

    // 3. update user_coins
    const existing = await trx('user_coins')
      .where({ user_id: creatorId, coin_id: mintAddress })
      .first();

    if (existing) {
      await trx('user_coins')
        .where({ user_id: creatorId, coin_id: mintAddress })
        .update({
          tokens_held: trx.raw('tokens_held + ?', [tokensReceived]),
        });
    } else {
      await trx('user_coins').insert({
        user_id: creatorId,
        coin_id: mintAddress,
        tokens_held: tokensReceived,
        avg_buy_price: price,
      });
    }

    // 4. update coins table with current price and market cap
    const totalSupplyValue = 1_000_000_000;
    
    // After a buy, circulating supply is at least tokensReceived
    // We can fetch the latest pool state to get accurate reserves and circulating supply
    let solReserves = 0;
    let tokenReserves = 0;
    let finalMarketCap = price * totalSupplyValue; // Default to FDV-like if calculation fails

    if (params.poolAddress) {
      try {
        const connection = getConnection('confirmed');
        const meteoraService = new MeteoraDBCService(connection);
        const poolRes = await meteoraService.getPoolState(params.poolAddress);
        
        if (poolRes.success && poolRes.pool) {
          const pool = poolRes.pool;
          solReserves = parseRawAmount(pool.quoteReserve);
          tokenReserves = parseRawAmount(pool.baseReserve);
          
          const circulatingSupply = calculateCirculatingSupply(totalSupplyValue, pool.baseReserve);
          const noSwaps = circulatingSupply === 0;
          
          finalMarketCap = calculateMarketCap(price, circulatingSupply, noSwaps, totalSupplyValue);

          // Update liquidity pool table
          await trx('coin_liquidity_pools')
            .where({ coin_id: mintAddress })
            .update({
              sol_reserves: solReserves,
              token_reserves: tokenReserves,
              updated_at: trx.fn.now()
            });
        }
      } catch (poolErr) {
        console.error('Error fetching pool state during finalizeWithBuy:', poolErr);
      }
    }
    
    await trx('coins')
      .where({ id: mintAddress })
      .update({
        current_price: price,
        market_cap: finalMarketCap,
        bonding_current_amount: trx.raw('bonding_current_amount + ?', [buyAmount]),
        // Update bonding progress: buyAmount / target (e.g. 100 SOL target)
        // For now using a placeholder or 100 SOL as default target
        bonding_progress: trx.raw('LEAST(100, (bonding_current_amount + ?) / 100 * 100)', [buyAmount])
      });


    // Calculate creator fee based on launch mode
    let creatorFeePercent = 0.01; // Default 1%
    if (params.launchMode === 'paperhand') {
      creatorFeePercent = 0.05; // 5% (50% of 10% tax)
    } else if (params.launchMode === 'founder') {
      creatorFeePercent = 0.01; // 1%
    }

    const creatorFee = buyAmount * creatorFeePercent;

    await trx('earning_tx').insert({
      creator_id: creatorId,
      coin_id: mintAddress,
      amount: creatorFee,
      type: 'fee',
      reference_id: txHash,
    });

    await trx('creator_earnings')
      .where({ creator_id: creatorId, coin_id: mintAddress })
      .update({
        total_earned: trx.raw('total_earned + ?', [creatorFee]),
        unclaimed: trx.raw('unclaimed + ?', [creatorFee]),
      });

    await trx.commit();

    return { success: true };
  } catch (err) {
    await trx.rollback();
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}


export async function getTokensService(params: any) {
  const { 
    category = 'new', 
    limit = 10, 
    offset = 0, 
    sortBy = 'created_at', 
    hasVideo = false,
    search = '' 
  } = params;

  let query = knex('coins')
    .leftJoin('users', 'coins.created_by', 'users.id')
    .leftJoin('coin_media', 'coins.id', 'coin_media.coin_id')
    .select(
      'coins.*',
      'users.username as creator',
      'coin_media.video_url',
      'coin_media.thumbnail_url'
    );

  // SEARCH
  if (search) {
    query.where(function() {
      this.where('coins.name', 'ilike', `%${search}%`)
          .orWhere('coins.symbol', 'ilike', `%${search}%`);
    });
  }

  // STATUS / CATEGORY FILTER
  if (category === 'movers') {
    // For movers, we want to show all active tokens but PRIORITIZE those meeting conditions:
    // priceChange24h >= 5% OR volume24h >= $10k OR txCount24h >= 100
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Join with a subquery to get 24h transaction counts
    query.leftJoin(
      knex('trades')
        .select('coin_id')
        .count('* as tx_count_24h')
        .where('created_at', '>=', twentyFourHoursAgo)
        .groupBy('coin_id')
        .as('tx_stats'),
      'coins.id',
      'tx_stats.coin_id'
    )
    .whereIn('coins.status', ['launching', 'migrated', 'live']);

    // Add a priority sort: tokens meeting any mover criteria come first
    // We use a CASE statement or raw boolean sort
    query.orderByRaw(`
      (CASE 
        WHEN coins.price_change_24h >= 5 OR coins.volume_24h >= 10000 OR tx_stats.tx_count_24h >= 100 
        THEN 1 
        ELSE 0 
      END) DESC
    `);
  } else if (category === 'new') {
    // New: createdAt >= now - 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    query.where('coins.created_at', '>=', twentyFourHoursAgo)
         .whereIn('coins.status', ['launching', 'migrated', 'live']);
  } else if (category === 'launching') {
    // Launching: bonding curve >= 90% and status is launching
    query.where('coins.status', 'launching')
         .andWhere('coins.bonding_progress', '>=', 90)
         .andWhere('coins.bonding_progress', '<', 100);
  } else if (category === 'migrated') {
    // Migrated: bonding curve === 100% or status is migrated
    query.where(function() {
      this.where('coins.status', 'migrated')
          .orWhere('coins.bonding_progress', '>=', 100);
    });
  } else {
    // Default: all active tokens
    query.whereIn('coins.status', ['launching', 'migrated', 'live']);
  }

  // VIDEO FILTER
  if (String(hasVideo) === 'true') {
    query.whereNotNull('coin_media.video_url');
  }

  // SORTING
  if (sortBy === 'lastTrade') {
    query.leftJoin(
      knex('trades')
        .select('coin_id')
        .max('created_at as last_trade_at')
        .groupBy('coin_id')
        .as('lt'),
      'coins.id',
      'lt.coin_id'
    )
    .select('lt.last_trade_at')
    .orderByRaw('lt.last_trade_at DESC NULLS LAST');
  } else if (sortBy === 'marketCap' || sortBy === 'market_cap') {
    query.orderBy('coins.market_cap', 'desc');
  } else if (sortBy === 'volume_24h' || sortBy === 'trading_volume') {
    query.orderBy('coins.volume_24h', 'desc');
  } else if (sortBy === 'bonding_progress' || sortBy === 'progress') {
    query.orderBy('coins.bonding_progress', 'desc');
  } else if (sortBy === 'movers') {
    query.orderBy('coins.price_change_24h', 'desc');
  } else if (sortBy === 'created_at' || sortBy === 'creation_time') {
    query.orderBy('coins.created_at', 'desc');
  } else {
    query.orderBy('coins.created_at', 'desc');
  }

  // PAGINATION
  const totalCountResult = await query.clone().clearSelect().clearOrder().count({ total: 'coins.id' }).first();
  const tokens = await query.limit(Number(limit)).offset(Number(offset));
  const total = Number(totalCountResult?.total || 0);

  return {
    success: true,
    data: tokens,
    total: total,
    hasMore: Number(offset) + tokens.length < total
  };
}

export async function getTokenDetailsService(coinId: string) {
  try {
    const coin = await knex('coins')
      .leftJoin('users', 'coins.created_by', 'users.id')
      .leftJoin('coin_media', 'coins.id', 'coin_media.coin_id')
      .select(
        'coins.*',
        'users.username as creator_name',
        'users.profile_image_url as creator_image',
        'coin_media.video_url',
        'coin_media.thumbnail_url'
      )
      .where('coins.id', coinId)
      .first();

    if (!coin) {
      return { success: false, error: 'Coin not found' };
    }

    const creatorEarnings = await knex('creator_earnings')
      .where({ coin_id: coinId })
      .first();

    const launchConfig = await knex('coin_launch_config')
      .where({ coin_id: coinId })
      .first();

    return {
      success: true,
      data: {
        ...coin,
        creator_earnings: creatorEarnings || null,
        launch_config: launchConfig || null,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getTopHoldersService(coinId: string, limit: number = 10) {
  try {
    const coin = await knex('coins').where({ id: coinId }).first();
    if (!coin) {
      return { success: false, error: 'Coin not found' };
    }

    const currentPrice = parseFloat(coin.current_price || '0');
    const totalSupply = parseFloat(coin.total_supply || '0');

    const holders = await knex('user_coins')
      .leftJoin('users', 'user_coins.user_id', 'users.id')
      .leftJoin('wallets', function() {
        this.on('users.id', '=', 'wallets.user_id')
            .andOn('wallets.is_primary', '=', knex.raw('?', [true]))
      })
      .select(
        'user_coins.user_id',
        'user_coins.tokens_held',
        'users.username',
        'users.profile_image_url',
        'wallets.address as wallet_address'
      )
      .where('user_coins.coin_id', coinId)
      .andWhere('user_coins.tokens_held', '>', 0)
      .orderBy('user_coins.tokens_held', 'desc')
      .limit(limit);

    const formattedHolders = holders.map(h => {
      const tokensHeld = parseFloat(h.tokens_held || '0');
      const valueUsd = tokensHeld * currentPrice;
      const percentage = totalSupply > 0 ? (tokensHeld / totalSupply) * 100 : 0;

      return {
        user_id: h.user_id,
        username: h.username,
        profile_image_url: h.profile_image_url,
        wallet_address: h.wallet_address,
        tokens_held: tokensHeld,
        value_usd: valueUsd,
        percentage: percentage,
      };
    });

    return { success: true, data: formattedHolders };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

