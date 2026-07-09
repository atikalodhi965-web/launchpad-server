
export interface RawBirdeyeTxItem {
    signature?: string;
    owner?: string;
    blockUnixTime?: number;
    base?: {address?: string; uiAmount?: number; symbol?: string};
    quote?: {address?: string; uiAmount?: number; symbol?: string};
    tx_type?: string;
}

export interface TradeRow {
tx_hash: string;
owner: string;
base_mint: string;
base_symbol?: string | null;
base_amount?: number | null;
quote_mint: string;
quote_symbol?: string | null;
quote_amount?: number | null;
side?: string | null;
price?: number | null;
block_time?: Date | null;
username?: string | null;
avatar_url?: string | null;
source?: string;
}