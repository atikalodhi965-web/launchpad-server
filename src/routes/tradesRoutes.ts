import { Router } from 'express';
import { fetchTrades, ingestNow, listLatestTrades, recordSwap, getChartData, getTradesByCoin } from '../controllers/tradesController';

const tradesRouter = Router();

// REST endpoints

// Get the most recent trades across all coins (general feed)
tradesRouter.get('/', listLatestTrades);

// Manually trigger ingestion of external trades from Birdeye
tradesRouter.post('/ingest', ingestNow); 

// Fetch recent swaps from Birdeye directly
tradesRouter.get('/fetch', fetchTrades);

// Record a new swap/trade that occurred on the platform
tradesRouter.post('/record-swap', recordSwap as any);

// Get OHLCV chart data for a specific coin
tradesRouter.get('/charts/:coinId', getChartData as any);

// Get all trades for a specific coin
tradesRouter.get('/coin/:coinId', getTradesByCoin);

export default tradesRouter;