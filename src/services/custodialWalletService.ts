import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import knex from "../db/knex"; // make sure knex is exported from src/db/knex.ts
import { decryptB64 } from "../utils/crypto"; // assumes you have encrypt/decrypt utils


// Wallet row shape
export interface WalletRow {
  id: string;
  address: string;
  public_key: string;
  provider: string;
  provider_data?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}
// ------------------------------
// Create wallet (local provider)
// ------------------------------
export async function createWalletLocal(kp: Keypair): Promise<WalletRow> {
  const [wallet] = await knex<WalletRow>("custodial_wallets")
    .insert({
      address: kp.publicKey.toBase58(),
      public_key: bs58.encode(kp.publicKey.toBytes()),
      provider: "local",
    })
    .returning("*");

  const encryptedSecret = encryptSecret(kp.secretKey); // your encryption util

  await knex("custodial_keys").insert({
    wallet_id: wallet.id,
    encrypted_secret: encryptedSecret,
  });

  return wallet;
}

// ------------------------------
// Get wallet by ID
// ------------------------------
export async function getWallet(walletId: string): Promise<WalletRow | null> {
  const row = await knex<WalletRow>("custodial_wallets")
    .where({ id: walletId })
    .first();
  return row || null;
}

// ------------------------------
// Get wallet by address
// ------------------------------
export async function getWalletByAddress(
  address: string
): Promise<WalletRow | null> {
  const row = await knex<WalletRow>("custodial_wallets")
    .where({ address })
    .first();
  return row || null;
}

// ------------------------------
// Load local keypair
// ------------------------------
export async function loadLocalKeypair(walletId: string): Promise<Keypair> {
  const row = await knex("custodial_keys")
    .where({ wallet_id: walletId })
    .first();

  if (!row) throw new Error("Secret not found");

  const secretBytes = decryptB64(row.encrypted_secret);
  return Keypair.fromSecretKey(new Uint8Array(secretBytes));
}

// ------------------------------
// Sign transaction locally
// ------------------------------
export async function signTxLocal(
  walletId: string,
  txB64: string
): Promise<string> {
  const kp = await loadLocalKeypair(walletId);
  const raw = Buffer.from(txB64, "base64");

  try {
    const vtx = VersionedTransaction.deserialize(raw);
    vtx.sign([kp]);
    return Buffer.from(vtx.serialize()).toString("base64");
  } catch {
    const tx = Transaction.from(raw);
    tx.partialSign(kp);
    return tx.serialize({ requireAllSignatures: false }).toString("base64");
  }
}

// ------------------------------
// Placeholder for Turnkey
// ------------------------------
export async function signTxWithTurnkey(
  _wallet: WalletRow,
  _txB64: string
): Promise<string> {
  throw new Error(
    "Turnkey signing not wired in this minimal static demo. Use provider=local."
  );
}

// ------------------------------
// Example util for encrypt
// ------------------------------
function encryptSecret(secret: Uint8Array): string {
  // convert to Buffer, encrypt with SECRET_ENC_KEY, return base64 string
  // implement using your utils/crypto
  return "base64encrypted"; // placeholder
}