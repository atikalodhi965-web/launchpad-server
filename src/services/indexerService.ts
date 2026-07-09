import { Connection, clusterApiUrl } from '@solana/web3.js';
import PQueue from 'p-queue';
import knex from '../db/knex'; // your existing knex instance
// import { parseSwapFromTransaction } from './swapParser';
import { parseSwapFromTransaction } from './SwapParser';
import { Server as SocketIOServer } from 'socket.io';

const RPC_HTTP = process.env.RPC_HTTP_URL || clusterApiUrl('mainnet-beta');
const RPC_WS   = process.env.RPC_WS_URL || RPC_HTTP.replace(/^http/, 'ws');

const QUEUE_INTERVAL = Number(process.env.INDEXER_INTERVAL_MS || '1000'); // ms window
const QUEUE_CAP = Number(process.env.INDEXER_INTERVAL_CAP || '6');       // calls per interval
const CONCURRENCY = Number(process.env.INDEXER_CONCURRENCY || '2');

let connection: Connection | null = null;

// fast filter: look for these substrings in logs (adjust via env)
const AMM_PROGRAM_IDS = (process.env.AMM_PROGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

function looksLikeSwapLog(logs: string[]) {
  if (!logs || logs.length === 0) return false;
  if (AMM_PROGRAM_IDS.length) {
    // require at least one program id mention
    return logs.some(l => AMM_PROGRAM_IDS.some(pid => l.includes(pid)));
  }
  // fallback hints
  return logs.some(l => /Swap|swap|SwapV2|SwapV1|SwapExact|TransferChecked/i.test(l));
}

export async function startIndexer(io: SocketIOServer) {
  if (connection) return;
  connection = new Connection(RPC_HTTP, { wsEndpoint: RPC_WS, commitment: 'confirmed' });

  // rate-limited queue for connection.getTransaction calls
  const queue = new PQueue({ interval: QUEUE_INTERVAL, intervalCap: QUEUE_CAP, concurrency: CONCURRENCY });

  // fetch list of addresses to watch from DB
  const rows = await knex.select('address').from('watched_addresses');
  console.log(`Indexer: subscribing to ${rows.length} watched addresses`);

  // helper to de-duplicate signatures quickly in DB
  async function alreadyProcessed(signature: string) {
    const r = await knex('processed_signatures').select('signature').where({ signature }).first();
    return !!r;
  }
  async function markProcessed(signature: string) {
    await knex('processed_signatures').insert({ signature }).onConflict('signature').ignore();
  }

  // async function processSignature(signature: string, wallet: string, slot?: number) {
  //   if (await alreadyProcessed(signature)) return;
  //   await markProcessed(signature);

  //   // enqueue getTransaction to avoid rate limit; return null on error
  //   const tx = await queue.add(async () => {
  //     try {
  //       return await connection!.getTransaction(signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  //     } catch (err) {
  //       console.warn('getTransaction failed', err?.message || err);
  //       return null;
  //     }
  //   });

  //   if (!tx || !tx.meta || tx.meta.err) return;

  //   const parsed = parseSwapFromTransaction(tx);
  //   if (!parsed) return;

  //   // upsert into swaps table
  //   try {
  //     await knex('swaps').insert({
  //       signature,
  //       slot: tx.slot ?? slot ?? null,
  //       block_time: tx.blockTime ?? null,
  //       wallet,
  //       in_mint: parsed.in_mint,
  //       in_amount: parsed.in_amount,
  //       out_mint: parsed.out_mint,
  //       out_amount: parsed.out_amount,
  //       program_id: parsed.program_id,
  //       raw: JSON.stringify({ meta: tx.meta }),
  //     }).onConflict(['signature']).ignore();

  //     // emit to clients (global channel)
  //     io.emit('swap:new', {
  //       signature,
  //       slot: tx.slot ?? slot ?? null,
  //       blockTime: tx.blockTime ?? null,
  //       wallet,
  //       inMint: parsed.in_mint,
  //       inAmount: parsed.in_amount,
  //       outMint: parsed.out_mint,
  //       outAmount: parsed.out_amount,
  //       programId: parsed.program_id,
  //     });
  //   } catch (err) {
  //     console.error('Failed to insert swap:', err?.message || err);
  //   }
  // }

  // subscribe one logs subscription per address
  // for (const r of rows) {
  //   const address = r.address;
  //   try {
  //     connection.onLogs(
  //       address,
  //       async (log) => {
  //         try {
  //           const signature = log?.value?.signature;
  //           const logs: string[] = log?.value?.logs ?? [];
  //           const slot = log?.context?.slot ?? log?.result?.context?.slot;
  //           if (!signature) return;
  //           if (!looksLikeSwapLog(logs)) return; // fast filter
  //           await processSignature(signature, address, slot);
  //         } catch (err) {
  //           console.error('onLogs handler error:', err?.message || err);
  //         }
  //       },
  //       'confirmed'
  //     );
  //     console.log(`Subscribed logs for ${address}`);
  //   } catch (err) {
  //     console.error('Subscription failed for', address, err?.message || err);
  //   }
  // }

  console.log('Indexer started');
}