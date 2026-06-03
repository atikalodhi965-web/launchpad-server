import BN from 'bn.js';
import knex from '../db/knex';

export function parseRawAmount(value: any): number {
    if (value === undefined || value === null) return 0;

    if (typeof value === 'number') return value;

    if (typeof value === 'object' && value.toString) {
        value = value.toString();
    }

    if (typeof value === 'string') {
        // Handle hex explicitly
        if (value.startsWith('0x')) {
            try {
                return Number(BigInt(value));
            } catch (e) {
                return 0;
            }
        }

        // Detect hex strings without 0x prefix
        // Usually these are long strings of hex characters
        const hexRegex = /^[0-9a-fA-F]{2,}$/;
        if (hexRegex.test(value) && isNaN(Number(value))) {
            try {
                return Number(BigInt('0x' + value));
            } catch (e) {
                // fall through to decimal
            }
        }

        // Otherwise treat as decimal (normal case)
        return Number(value);
    }

    return 0;
}

export function calculateTokenPrice(baseReserve: any, quoteReserve: any, baseDecimals: number = 6, quoteDecimals: number = 9): number {
    const base = parseRawAmount(baseReserve);
    const quote = parseRawAmount(quoteReserve);

    if (base === 0) return 0;

    const baseAmount = base / Math.pow(10, baseDecimals);
    const quoteAmount = quote / Math.pow(10, quoteDecimals);

    return quoteAmount / baseAmount;
}

export function calculateCirculatingSupply(totalSupply: number, baseReserveRaw: any, baseDecimals: number = 6): number {
    const baseReserveAmount = parseRawAmount(baseReserveRaw) / Math.pow(10, baseDecimals);
    return Math.max(0, totalSupply - baseReserveAmount);
}

export function calculateMarketCap(price: number, supply: number, noSwaps: boolean = false, totalSupply: number = 1000000000): number {
    const supplyToUse = noSwaps ? totalSupply : supply;
    return price * supplyToUse;
}

export function calculateLiquidity(quoteReserveAmount: any, quoteDecimals: number = 9): number {
    // Formula: quote reserves * 2
    const quote = parseRawAmount(quoteReserveAmount);
    return (quote / Math.pow(10, quoteDecimals)) * 2;
}

export function calculateBondingProgress(progressRatio: number): number {
    // Progress % = progress * 100
    return progressRatio * 100;
}

export async function getVolumeForTimeframe(coinId: string, timeframeMinutes: number): Promise<number> {
    const since = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    const result = await knex('trades')
        .where('coin_id', coinId)
        .andWhere('created_at', '>=', since)
        .sum('usd_value as total_volume')
        .first();
        
    return Number(result?.total_volume || 0);
}

export async function getPriceChangePercentage(coinId: string, timeframeMinutes: number, currentPrice: number): Promise<number> {
    const since = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    
    // Get the first trade after the 'since' timestamp to act as the start price
    const startTrade = await knex('trades')
        .where('coin_id', coinId)
        .andWhere('created_at', '>=', since)
        .orderBy('created_at', 'asc')
        .first();

    if (!startTrade || !startTrade.price) return 0;
    
    const startPrice = Number(startTrade.price);
    if (startPrice === 0) return 0;

    return ((currentPrice - startPrice) / startPrice) * 100;
}

export async function getTxCountForTimeframe(coinId: string, timeframeMinutes: number): Promise<number> {
    const since = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    const result = await knex('trades')
        .where('coin_id', coinId)
        .andWhere('created_at', '>=', since)
        .count('* as tx_count')
        .first();
        
    return Number(result?.tx_count || 0);
}
