import { Router, Request, Response } from "express";
import knex from "../db/knex";

const walletRouter = Router();

/**
 * POST /api/wallets
 * Body: { userId: string, address: string, chain: string, isPrimary?: boolean }
 * 
 * Adds a new wallet to the wallets table for the specified user.
 */
walletRouter.post("/create-wallet", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, address, chain, isPrimary } = req.body;

    if (!userId || !address || !chain) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, address, chain",
      });
    }

    // Check if user exists
    const user = await knex("users").where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if wallet already exists
    const existingWallet = await knex("wallets").where({ address, user_id: userId }).first();
    if (existingWallet) {
      return res.json({
        success: true,
        message: "Wallet already associated with this user",
        wallet: existingWallet,
        isNew: false
      });
    }

    // Check if wallet is associated with another user
    const walletWithOtherUser = await knex("wallets").where({ address }).whereNot({ user_id: userId }).first();
    if (walletWithOtherUser) {
        return res.status(400).json({
            success: false,
            error: "Wallet already associated with another user",
        });
    }

    // If marked as primary, optionally unset other primary wallets for this user
    if (isPrimary) {
      await knex("wallets")
        .where({ user_id: userId, is_primary: true })
        .update({ is_primary: false });
    }

    // Insert into wallets table
    const [newWallet] = await knex("wallets")
      .insert({
        user_id: userId,
        address,
        chain,
        is_primary: isPrimary || false,
      })
      .returning("*");

    return res.json({ success: true, wallet: newWallet });
  } catch (error: any) {
    console.error("[Add Wallet] error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/wallets/:userId
 * 
 * Returns all wallets associated with the specified user.
 */
walletRouter.get("/:userId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId parameter" });
    }

    // Check user exists
    const user = await knex("users").where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const wallets = await knex("wallets").where({ user_id: userId });

    return res.json({ success: true, wallets });
  } catch (error: any) {
    console.error("[Get Wallets] error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default walletRouter;
