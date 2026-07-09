import knex from '../db/knex';
import crypto from 'crypto';

export function generateReferralCode(username: string, userId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 6);

  // Remove spaces and special characters from username
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanUsername}-${hash}`;
}

export async function getReferralStats(userId: string) {
  // Friends Referred count
  const referralsCount = await knex('referrals')
    .where({ referrer_id: userId })
    .count('id as count')
    .first();

  const user = await knex('users').where({ id: userId }).select('referral_code').first();

  // Total Earned (Total commission from trades)
  const totalEarnedCommission = await knex('referral_earnings')
    .where({ referrer_id: userId })
    .sum('amount_usd as sum')
    .first();

  // Active Referrals (People you referred)
  const activeReferrals = Number(referralsCount?.count || 0);

  // Total Rewards from specific referral bonuses (if any)
  const totalReferralRewards = await knex('referrals')
    .where({ referrer_id: userId })
    .sum('reward_usd as sum')
    .first();

  const totalEarned = Number(totalEarnedCommission?.sum || 0) + Number(totalReferralRewards?.sum || 0);

  return {
    totalEarned: totalEarned || 0,
    activeReferrals: activeReferrals || 0,
    commissionPaid: Number(totalEarnedCommission?.sum || 0), // Assuming paid means earned for now
    referralCode: user?.referral_code || ''
  };
}

export async function getReferrerReferrals(userId: string) {
  const referrals = await knex('referrals as r')
    .join('users as u', 'r.referee_id', 'u.id')
    .leftJoin('referral_earnings as re', function() {
        this.on('r.referrer_id', 're.referrer_id').andOn('r.referee_id', 're.referee_id')
    })
    .leftJoin('trades as t', 'r.referee_id', 't.user_id')
    .where('r.referrer_id', userId)
    .select(
        'u.username',
        'u.profile_image_url',
        'r.created_at',
        knex.raw('COALESCE(SUM(DISTINCT re.amount_usd), 0)::numeric as total_earned'),
        knex.raw('COALESCE(SUM(t.usd_value), 0)::numeric as total_volume')
    )
    .groupBy('u.id', 'r.id')
    .orderBy('r.created_at', 'desc');

  return referrals;
}

export async function getReferralLeaderboard() {
  // Rank, Wallet, Referrals, Earnings
  const leaderboard = await knex('users as u')
    .leftJoin('referrals as r', 'u.id', 'r.referrer_id')
    .leftJoin('referral_earnings as re', 'u.id', 're.referrer_id')
    .leftJoin('wallets as w', function() {
      this.on('u.id', 'w.user_id').andOn('w.is_primary', knex.raw('true'))
    })
    .select(
      'u.id',
      'u.username',
      'u.profile_image_url',
      'w.address as wallet_address',
      knex.raw('COUNT(DISTINCT r.id)::int as total_referrals'),
      knex.raw('(COALESCE(SUM(DISTINCT r.reward_usd), 0) + COALESCE(SUM(re.amount_usd), 0))::numeric as total_earnings')
    )
    .groupBy('u.id', 'w.address')
    .having(knex.raw('COUNT(DISTINCT r.id) > 0 OR SUM(re.amount_usd) > 0'))
    .orderBy('total_earnings', 'desc')
    .limit(50);

  return leaderboard.map((item, index) => ({
    rank: index + 1,
    ...item
  }));
}

export async function acceptReferral(userId: string, referralCode: string) {
  return await knex.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).first();
    if (!user) throw new Error('User not found');
    if (user.referred_by_code) throw new Error('Referral already used');

    const referrer = await trx('users').where({ referral_code: referralCode }).first();
    if (!referrer) throw new Error('Invalid referral code');
    if (referrer.id === userId) throw new Error('Self-referral is not allowed');

    // Update user
    await trx('users').where({ id: userId }).update({
      referred_by_code: referralCode,
      referral_accepted_at: trx.fn.now()
    });

    // Insert referral record
    await trx('referrals').insert({
      referrer_id: referrer.id,
      referee_id: userId,
      referral_code: referralCode,
      status: 'COMPLETED', // Linked is completed enough to start earned 0.5%
      completed_at: trx.fn.now()
    });

    return { success: true };
  });
}

export async function skipReferral(userId: string) {
  await knex('users')
    .where({ id: userId })
    .update({
      referral_accepted_at: knex.fn.now()
    });
  
  return { success: true };
}

export async function handleTradeCommission(tradeId: string, userId: string, tradeUsdValue: number) {
  const user = await knex('users').where({ id: userId }).first();
  if (!user || !user.referred_by_code) return;

  const referrer = await knex('users').where({ referral_code: user.referred_by_code }).first();
  if (!referrer) return;

  const commissionRate = 0.005; // 0.5%
  const commissionUsd = tradeUsdValue * commissionRate;

  if (commissionUsd <= 0) return;

  await knex('referral_earnings').insert({
    referrer_id: referrer.id,
    referee_id: userId,
    trade_id: tradeId,
    amount_usd: commissionUsd
  });
}

export async function recordTradeWithCommission(params: {
  userId: string;
  coinId: string;
  type: 'buy' | 'sell';
  price: number;
  usdValue: number;
  inputAmount: number;
  outputAmount: number;
  txHash: string;
}, trx?: any) {
  const db = trx || knex;

  // 1. Insert the trade
  const [trade] = await db('trades').insert({
    user_id: params.userId,
    coin_id: params.coinId,
    type: params.type,
    price: params.price,
    usd_value: params.usdValue,
    input_amount: params.inputAmount,
    output_amount: params.outputAmount,
    tx_hash: params.txHash,
  }).returning('*');

  // 2. Handle commission
  await handleTradeCommission(trade.id, params.userId, params.usdValue);

  return trade;
}

export async function getEarningConfig() {
  const commissionRate = 0.005; // 0.5%
  const exampleTiers = [
    { volume: 10000 },
    { volume: 50000 },
    { volume: 100000 },
    { volume: 500000 },
    { volume: 1000000 },
  ];

  const tiers = exampleTiers.map(tier => ({
    dailyVolume: tier.volume,
    dailyEarnings: tier.volume * commissionRate,
    monthlyEarnings: tier.volume * commissionRate * 30
  }));

  return {
    commissionRate,
    tiers
  };
}
