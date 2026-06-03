import { ParsedConfirmedTransaction } from '@solana/web3.js';

/**
 * Build map of (owner+mint) -> {pre, post} ui amounts, then compute deltas.
 */

function computeDeltas(tx: any) {
  const pre = tx?.meta?.preTokenBalances || [];
  const post = tx?.meta?.postTokenBalances || [];
  const map = new Map<string, { mint: string; owner?: string; pre: number; post: number; delta: number }>();

  pre.forEach((p: any) => {
    const key = `${p.owner || ''}:${p.mint || ''}`;
    const ui = Number(p.uiTokenAmount?.uiAmount || 0);
    map.set(key, { mint: p.mint, owner: p.owner, pre: ui, post: 0, delta: 0 });
  });

  post.forEach((p: any) => {
    const key = `${p.owner || ''}:${p.mint || ''}`;
    const ui = Number(p.uiTokenAmount?.uiAmount || 0);
    const entry = map.get(key);
    if (entry) {
      entry.post = ui;
      entry.delta = +(ui - entry.pre);
      map.set(key, entry);
    } else {
      map.set(key, { mint: p.mint, owner: p.owner, pre: 0, post: ui, delta: +(ui - 0) });
    }
  });

  return Array.from(map.values()).filter(x => x.delta !== 0);
}

/**
 * Parse a transaction and extract a simple swap object: spent mint (negative delta),
 * received mint (positive delta). Conservative: require at least 2 distinct mints.
 */
export function parseSwapFromTransaction(tx: any) {
  if (!tx || !tx.meta) return null;
  const deltas = computeDeltas(tx);
  const byMint = new Map<string, number>();
  deltas.forEach(d => byMint.set(d.mint, (byMint.get(d.mint) || 0) + d.delta));
  const entries = Array.from(byMint.entries()).filter(([mint, delta]) => delta !== 0).map(([mint, delta]) => ({ mint, delta }));

  if (entries.length < 2) return null;

  // find one negative and one positive
  const spent = entries.find(e => e.delta < 0);
  const received = entries.find(e => e.delta > 0);
  if (!spent || !received) return null;

  // attempt to find program id (optional)
  const programId = tx?.transaction?.message?.instructions?.find((i: any) => i.programId)?.programId || null;

  return {
    in_mint: spent.mint,
    in_amount: Math.abs(spent.delta),
    out_mint: received.mint,
    out_amount: received.delta,
    program_id: programId,
  };
}

