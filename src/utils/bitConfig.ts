import 'dotenv/config';


export const CONFIG = {
    bitquery: {
        endpoint: 'wss://streaming.bitquery.io/eap',
        // Bitquery expects: connectionParams: { Authorization: 'Bearer <token>' }
        token: process.env.BITQUERY_TOKEN,
    },
    solana: {
        rpcWs: process.env.SOLANA_RPC_WS || 'wss://api.mainnet-beta.solana.com',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};


if (!CONFIG.bitquery.token) {
    throw new Error('Missing BITQUERY_TOKEN in .env');
}