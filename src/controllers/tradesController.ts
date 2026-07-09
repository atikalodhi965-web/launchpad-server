import { Request, Response } from 'express';
import { getLatestTrades, ingestOnceAndBroadcast } from '../services/tradeServices';
import { fetchRecentSwapsFromBirdeye } from '../services/tradeServices';
import knex from '../db/knex';
import { MeteoraDBCService } from '../service/MeteoraDBC/meteoraDBCService';
import { getConnection } from '../utils/connection';
import { 
  calculateTokenPrice, 
  calculateMarketCap, 
  calculateCirculatingSupply, 
  calculateLiquidity,
  calculateBondingProgress,
  getVolumeForTimeframe,
  getPriceChangePercentage,
  parseRawAmount 
} from '../utils/tokenStats';

export async function listLatestTrades(req: Request, res: Response) {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 200);
        const rows = await getLatestTrades(limit);
        res.json({ success: true, items: rows });
    } catch (e: any) {
        console.error('listLatestTrades error:', e?.message || e);
        res.status(500).json({ success: false, error: 'Failed to load trades' });
    }
}


export async function ingestNow(req: Request, res: Response) {
    try {
        const io = (req as any).webSocketService?.io;
        const result = await ingestOnceAndBroadcast(io);
        res.json({ success: true, ...result });
    } catch (e: any) {
        console.error('ingestNow error:', e?.message || e);
        res.status(500).json({ success: false, error: 'Ingest failed' });
    }
}
export async function fetchTrades(req: Request, res: Response) {
    try {
    const data = await fetchRecentSwapsFromBirdeye();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

const timeframes = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

async function updateChartData(trx: any, coinId: string, price: number, volume: number) {
  const now = Date.now();
  
  for (const [tf, ms] of Object.entries(timeframes)) {
    const periodStart = new Date(Math.floor(now / ms) * ms);
    
    const existing = await trx('coin_charts')
      .where({ coin_id: coinId, timeframe: tf, period_start: periodStart })
      .first();
      
    if (existing) {
      await trx('coin_charts')
        .where({ id: existing.id })
        .update({
          high: Math.max(existing.high, price),
          low: Math.min(existing.low, price),
          close: price,
          volume: parseFloat(existing.volume) + volume,
          updated_at: trx.fn.now()
        });
    } else {
      await trx('coin_charts').insert({
        coin_id: coinId,
        timeframe: tf,
        period_start: periodStart,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume
      });
    }
  }
}

export async function getChartData(req: Request, res: Response) {
  try {
    const { coinId } = req.params;
    const { timeframe = '1m', limit = 1000 } = req.query;
    
    const charts = await knex('coin_charts')
      .where({ coin_id: coinId, timeframe: timeframe as string })
      .orderBy('period_start', 'desc')
      .limit(Number(limit));
      
    res.json({ success: true, data: charts.reverse() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function recordSwap(req: Request, res: Response) {
  const {
    userId,
    coinId,
    type,
    price,
    inputAmount,
    outputAmount,
    txHash,
    usdValue,
    referralCode,
    creatorId,
    creatorFeeUsd,
    poolAddress // Should be passed from frontend
  } = req.body;

  if (!userId || !coinId || !type || price === undefined || isNaN(price) || !txHash) {
    console.error('RecordSwap 400 - Missing params:', {
      userId: !!userId,
      coinId: !!coinId,
      type: !!type,
      price: price !== undefined,
      txHash: !!txHash
    });
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required parameters', 
      details: { userId, coinId, type, price, txHash } 
    });
  }

  const trx = await knex.transaction();

  try {
    // 1. Insert into trades table
    const [newTrade] = await trx('trades').insert({
      user_id: userId,
      coin_id: coinId,
      type: type, // 'buy' or 'sell'
      price: price,
      input_amount: inputAmount || 0,
      output_amount: outputAmount || 0,
      tx_hash: txHash,
      usd_value: usdValue || 0
    }).returning('*');

    // 2. Fetch latest pool state and update coin stats
    let latestPrice = parseFloat(price);
    let latestMarketCap = 0;
    let latestCirculatingSupply = 0;
    let latestSolReserves = 0;
    let latestTokenReserves = 0;
    let creatorQuoteFee = 0;

    if (poolAddress) {
      try {
        const connection = getConnection('confirmed');
        const meteoraService = new MeteoraDBCService(connection);
        const poolRes = await meteoraService.getPoolState(poolAddress);
        
        if (poolRes.success && poolRes.pool) {
          const pool = poolRes.pool;
          latestSolReserves = parseRawAmount(pool.quoteReserve);
          latestTokenReserves = parseRawAmount(pool.baseReserve);
          latestPrice = calculateTokenPrice(pool.baseReserve, pool.quoteReserve);
          
          if (pool.creatorQuoteFee) {
            // Convert hex quote fee to human readable SOL (9 decimals)
            creatorQuoteFee = parseRawAmount(pool.creatorQuoteFee) / 1e9;
          }

          const coinInfo = await trx('coins').where({ id: coinId }).first();
          const totalSupply = parseFloat(coinInfo?.total_supply || 1_000_000_000);
          
          latestCirculatingSupply = calculateCirculatingSupply(totalSupply, pool.baseReserve);
          const noSwaps = latestCirculatingSupply === 0;
          latestMarketCap = calculateMarketCap(latestPrice, latestCirculatingSupply, noSwaps, totalSupply);

          // Update liquidity pool table
          await trx('coin_liquidity_pools')
            .where({ coin_id: coinId })
            .update({
              sol_reserves: latestSolReserves,
              token_reserves: latestTokenReserves,
              updated_at: trx.fn.now()
            });
        }
      } catch (poolErr) {
        console.error('Error fetching pool state during recordSwap:', poolErr);
      }
    }

    // 3. Calculate volumes and price change (using utils as in sync-stats)
    const [vol1m, vol5m, vol1h, vol6h, vol24h, pct24h] = await Promise.all([
      getVolumeForTimeframe(coinId, 1),
      getVolumeForTimeframe(coinId, 5),
      getVolumeForTimeframe(coinId, 60),
      getVolumeForTimeframe(coinId, 360),
      getVolumeForTimeframe(coinId, 1440),
      getPriceChangePercentage(coinId, 1440, latestPrice)
    ]);

    // 4. Update coins table
    const coin = await trx('coins').where({ id: coinId }).first();
    if (coin) {
      const updateData: any = {
        current_price: latestPrice,
        market_cap: latestMarketCap,
        circulating_supply: latestCirculatingSupply,
        volume_1m: vol1m,
        volume_5m: vol5m,
        volume_1h: vol1h,
        volume_6h: vol6h,
        volume_24h: vol24h,
        price_change_24h: pct24h,
      };

      // Add bonding curve updates
      const target = Math.max(1, parseFloat(coin.bonding_target_amount || 100));
      const current = parseFloat(coin.bonding_current_amount || 0);
      
      if (type === 'buy') {
        updateData.bonding_current_amount = trx.raw('COALESCE(bonding_current_amount, 0) + ?', [usdValue]);
        updateData.bonding_progress = Math.min(100, ((current + parseFloat(usdValue)) / target) * 100);
      } else if (type === 'sell') {
        updateData.bonding_current_amount = trx.raw('GREATEST(0, COALESCE(bonding_current_amount, 0) - ?)', [usdValue]);
        updateData.bonding_progress = Math.max(0, ((current - parseFloat(usdValue)) / target) * 100);
      }

      // Update ATH if needed
      if (!coin.ath_price || latestPrice > parseFloat(coin.ath_price)) {
        updateData.ath_price = latestPrice;
        updateData.ath_marketcap = latestMarketCap;
      }

      await trx('coins').where({ id: coinId }).update(updateData);
    }

    // 5. Update user_coins and calculate PnL
    const userCoin = await trx('user_coins').where({ user_id: userId, coin_id: coinId }).first();
    let profit = 0;

    if (type === 'buy') {
      const tokensToAdd = parseFloat(outputAmount || 0);
      if (userCoin) {
        const currentTokens = parseFloat(userCoin.tokens_held || 0);
        const currentTotalCost = currentTokens * parseFloat(userCoin.avg_buy_price || 0);
        const newTotalCost = currentTotalCost + parseFloat(usdValue || 0);
        const newTotalTokens = currentTokens + tokensToAdd;
        const newAvgBuyPrice = newTotalTokens > 0 ? newTotalCost / newTotalTokens : 0;

        await trx('user_coins').where({ id: userCoin.id }).update({
          tokens_held: newTotalTokens,
          avg_buy_price: newAvgBuyPrice,
          updated_at: trx.fn.now()
        });
      } else {
        await trx('user_coins').insert({
          user_id: userId,
          coin_id: coinId,
          tokens_held: tokensToAdd,
          avg_buy_price: price,
        });
      }
    } else if (type === 'sell' && userCoin) {
      const tokensSold = parseFloat(inputAmount || 0);
      const currentTokens = parseFloat(userCoin.tokens_held || 0);
      const newTotalTokens = Math.max(0, currentTokens - tokensSold);

      // Realized PnL calculation
      const avgBuyPrice = parseFloat(userCoin.avg_buy_price || 0);
      const costBasis = avgBuyPrice * tokensSold;
      profit = parseFloat(usdValue || 0) - costBasis;

      await trx('user_coins').where({ id: userCoin.id }).update({
        tokens_held: newTotalTokens,
        realized_pnl: trx.raw('COALESCE(realized_pnl, 0) + ?', [profit]),
        updated_at: trx.fn.now()
      });
    }

    // 6. Update coin_holders
    const userWallet = await trx('wallets')
      .where({ user_id: userId, is_primary: true })
      .first();
    
    const latestUserCoin = await trx('user_coins').where({ user_id: userId, coin_id: coinId }).first();
    const tokensHeld = parseFloat(latestUserCoin?.tokens_held || 0);
    const valueUsd = tokensHeld * latestPrice;

    await trx('coin_holders')
      .insert({
        coin_id: coinId,
        user_id: userId,
        tokens_held: tokensHeld,
        value_usd: valueUsd,
        wallet_address: userWallet?.address || '',
        updated_at: trx.fn.now()
      })
      .onConflict(['coin_id', 'user_id'])
      .merge();

    // 7. Update user_portfolio and PnL snapshot
    const portfolio = await trx('user_portfolio').where({ user_id: userId }).first();
    
    // Calculate total portfolio value and unrealized PnL
    const allUserCoins = await trx('user_coins').where({ user_id: userId });
    let totalPortfolioValue = 0;
    let totalUnrealizedPnl = 0;

    for (const uc of allUserCoins) {
      const cInfo = await trx('coins').where({ id: uc.coin_id }).first();
      const cPrice = parseFloat(cInfo?.current_price || 0);
      const val = parseFloat(uc.tokens_held || 0) * cPrice;
      const cost = parseFloat(uc.tokens_held || 0) * parseFloat(uc.avg_buy_price || 0);
      
      totalPortfolioValue += val;
      totalUnrealizedPnl += (val - cost);
    }

    if (portfolio) {
      const updatePortfolio: any = {
        total_value: totalPortfolioValue,
        unrealized_pnl: totalUnrealizedPnl,
        last_updated: trx.fn.now()
      };

      if (type === 'buy') {
        updatePortfolio.total_invested = parseFloat(portfolio.total_invested || 0) + parseFloat(usdValue || 0);
      } else if (type === 'sell') {
        updatePortfolio.realized_pnl = parseFloat(portfolio.realized_pnl || 0) + profit;
      }

      await trx('user_portfolio').where({ user_id: userId }).update(updatePortfolio);
    } else {
      await trx('user_portfolio').insert({
        user_id: userId,
        total_value: totalPortfolioValue,
        total_invested: type === 'buy' ? usdValue : 0,
        unrealized_pnl: totalUnrealizedPnl,
        realized_pnl: type === 'sell' ? profit : 0,
        last_updated: trx.fn.now()
      });
    }

    // 8. Update creator_earnings with creatorQuoteFee
    if (creatorId && creatorId !== '0') {
      // Record earning tx if we have one
      if (creatorFeeUsd && parseFloat(creatorFeeUsd) > 0) {
        await trx('earning_tx').insert({
          creator_id: creatorId,
          coin_id: coinId,
          amount: parseFloat(creatorFeeUsd),
          type: 'fee',
          reference_id: txHash // Correct reference ID
        });
      }

      // Update or insert creator earnings
      // The user wants specifically creatorQuoteFee added to unclaimed
      if (creatorQuoteFee > 0) {
        const cEarnings = await trx('creator_earnings').where({ creator_id: creatorId, coin_id: coinId }).first();
        if (cEarnings) {
          await trx('creator_earnings').where({ id: cEarnings.id }).update({
            total_earned: parseFloat(cEarnings.total_earned || 0) + creatorQuoteFee,
            unclaimed: parseFloat(cEarnings.unclaimed || 0) + creatorQuoteFee
          });
        } else {
          await trx('creator_earnings').insert({
            creator_id: creatorId,
            coin_id: coinId,
            total_earned: creatorQuoteFee,
            total_claimed: 0,
            unclaimed: creatorQuoteFee
          });
        }
      }
    }
    
    // 9. Update referral_earnings
    const userRow = await trx('users').where({ id: userId }).first();
    let referrerId = null;
    if (userRow?.referred_by_code) {
      const referrer = await trx('users').where({ referral_code: userRow.referred_by_code }).first();
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    if (referrerId) {
      const referralFeeUsd = req.body.referralFeeUsd ? parseFloat(req.body.referralFeeUsd) : (parseFloat(usdValue || 0) * 0.005);
      if (referralFeeUsd > 0) {
        await trx('referral_earnings').insert({
          referrer_id: referrerId,
          referee_id: userId,
          trade_id: newTrade.id,
          amount_usd: referralFeeUsd
        });
        
        await trx('referrals')
          .where({ referrer_id: referrerId, referee_id: userId })
          .update({
             status: 'REWARDED',
             reward_usd: trx.raw('reward_usd + ?', [referralFeeUsd]),
             rewarded_at: trx.fn.now()
          });
      }
    }

    // 10. Update OHLCV charts
    await updateChartData(trx, coinId, latestPrice, parseFloat(usdValue || 0));

    // Commit transaction
    await trx.commit();

    return res.json({ success: true, tradeId: newTrade.id });
  } catch (error: any) {
    await trx.rollback();
    console.error('Error recording swap:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getTradesByCoin(req: Request, res: Response) {
  try {
    const { coinId } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Number(req.query.offset || 0);

    const trades = await knex('trades')
      .leftJoin('users', 'trades.user_id', 'users.id')
      .select(
        'trades.id',
        'trades.type',
        'trades.price',
        'trades.usd_value',
        'trades.input_amount',
        'trades.output_amount',
        'trades.tx_hash',
        'trades.created_at',
        'users.username as maker_name',
        'users.profile_image_url as maker_avatar',
        'users.id as maker_id',
        knex.raw('(SELECT address FROM wallets WHERE user_id = users.id ORDER BY is_primary DESC, id ASC LIMIT 1) as maker_wallet')
      )
      .where('trades.coin_id', coinId)
      .orderBy('trades.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const formattedTrades = trades.map((t: any) => {
      const solAmount = t.type === 'buy' ? t.input_amount : t.output_amount;
      const tokenAmount = t.type === 'buy' ? t.output_amount : t.input_amount;
      return {
        ...t,
        sol_amount: solAmount,
        token_amount: tokenAmount,
      };
    });

    res.json({ success: true, items: formattedTrades });
  } catch (e: any) {
    console.error('getTradesByCoin error:', e?.message || e);
    res.status(500).json({ success: false, error: 'Failed to load trades for coin' });
  }
}