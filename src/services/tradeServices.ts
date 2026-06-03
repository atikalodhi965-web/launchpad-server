import axios from 'axios';
import knex from '../db/knex';
import type { RawBirdeyeTxItem, TradeRow } from '../types/trades';
import type { WebSocketService } from '../service/websocketService';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
type Trade = {
    tx_hash: string;
    owner: string;
    base_mint: string;
    base_symbol: string | null;
    base_amount: number | null;
    quote_mint: string;
    quote_symbol: string | null;
    quote_amount: number | null;
    side: 'buy' | 'sell' | null;
    price: number | null;
    block_time: Date | null;
    username: string | null;
    avatar_url: string | null;
    source: string;
};

function toDateOrNull(ts?: number): Date | null {
    if (!ts) return null;
    try {
        return new Date(ts * 1000);
    } catch (error) {
        return null;
    }
}

function calcSideAndPrice(item: RawBirdeyeTxItem): { side?: string; price?: number } {
    // Heuristic: if base is SOL, then user likely sold SOL for token => side = 'buy-token'
    const base = item.base?.address;
    const quote = item.quote?.address;
    const baseAmt = item.base?.uiAmount ?? undefined;
    const quoteAmt = item.quote?.uiAmount ?? undefined;

    if (!base || !quote || baseAmt === undefined || quoteAmt === undefined) return {};

    if (base === SOL_MINT && quote !== SOL_MINT) {
        const price = quoteAmt !== 0 ? baseAmt / quoteAmt : undefined as unknown as number;
        return { side: 'buy-token', price };
    }
    if (quote === SOL_MINT && base !== SOL_MINT) {
        const price = baseAmt !== 0 ? quoteAmt / baseAmt : undefined as unknown as number;
        return { side: 'sell-token', price };
    }
    return {};
}

function mapBirdeyeItemToTrade(item: RawBirdeyeTxItem): TradeRow | null {
    const signature = item.signature;
    const owner = item.owner;
    const baseMint = item.base?.address;
    const quoteMint = item.quote?.address;

    if (!signature || !owner || !baseMint || !quoteMint) return null;

    const { side, price } = calcSideAndPrice(item);

    const row: TradeRow = {
        tx_hash: signature,
        owner,
        base_mint: baseMint,
        base_symbol: item.base?.symbol ?? null,
        base_amount: item.base?.uiAmount ?? null,
        quote_mint: quoteMint,
        quote_symbol: item.quote?.symbol ?? null,
        quote_amount: item.quote?.uiAmount ?? null,
        side: side ?? null,
        price: price ?? null,
        block_time: toDateOrNull(item.blockUnixTime),
        username: null,
        avatar_url: null,
        source: 'birdeye',
    };

    return row;
}

export async function fetchRecentSwapsFromBirdeye(limit = 50, offset = 0): Promise<RawBirdeyeTxItem[]> {
    const url = 'https://public-api.birdeye.so/defi/v3/txs/recent';
    const headers = {
        accept: 'application/json',
        'x-chain': 'solana',
        'X-Api-Key': process.env.BIRDEYE_API_KEY as string,
    };
    const params = {
        offset,
        limit,
        tx_type: 'swap',
        ui_amount_mode: 'scaled',
    } as const;

    const { data } = await axios.get(url, { headers, params });
    const items: RawBirdeyeTxItem[] = data?.data?.items ?? [];
    // console.log("items: ", items);
    return items;
}

export async function upsertTrades(rows: TradeRow[]): Promise<number> {
    if (!rows.length) return 0;
    // Postgres ON CONFLICT DO NOTHING on tx_hash
    await knex('trades')
        .insert(rows)
        .onConflict('tx_hash')
        .ignore();
    return rows.length;
}

export async function getLatestTrades(limit = 20) {
    const rows = await knex('trades')
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit);
    return rows;
}

export async function ingestOnceAndBroadcast(io?: WebSocketService['io']): Promise<{ inserted: number; fetched: number; }> {
    const raw = await fetchRecentSwapsFromBirdeye(100, 0);
    const mapped = raw.map(mapBirdeyeItemToTrade).filter((x): x is TradeRow => !!x);
    const inserted = await upsertTrades(mapped);


    // Broadcast only the *new* ones. Simple approach: emit all mapped; frontend can dedupe by tx_hash.
    if (io) {
        mapped.forEach((t) => io.emit('trades:new', t));
    }
    return { inserted, fetched: raw.length };
}

export function startTradesIngestor(io?: WebSocketService['io']) {
    const interval = Number(process.env.TRADES_POLL_INTERVAL_MS || 10_000);
    // Important: avoid overlapping runs
    let running = false;
    const tick = async () => {
        if (running) return; // prevents re-entry
        running = true;
        try {
            await ingestOnceAndBroadcast(io);
        } catch (e) {
            console.error('[TradesIngestor] error:', e);
        } finally {
            running = false;
        }
    };
    // initial
    void tick();
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer); // returns a stop function
}