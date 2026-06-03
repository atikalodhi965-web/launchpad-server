import express, { Request, Response } from "express";
import { config } from "dotenv";
import {
    GetAssetsByOwnerParams,
    GetAssetsByAuthorityParams,
    GetAssetsByGroupParams,
    GetAssetsByCreatorParams,
    GetSignaturesForAssetParams,
    SearchAssetsParams,
    GetTokenAccountsParams,
    GetAssetProofParams,
    GetAssetsByBatchParams,
    GetAssetProofBatchParams
} from "../../types/aura/interface";
import fetch from 'node-fetch';
config();
const router = express.Router() as any;


async function fetchRPC(method: string, params: any) {
    const response = await fetch(process.env.RPC_URL || "https://api.devnet.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
}
router.get('/get-trending-tokens', async (req: Request, res: Response) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'X-API-Key': `${process.env.MORALIS_API_KEY}`
        },
    };

    fetch('https://deep-index.moralis.io/api/v2.2/tokens/trending?chain=solana', options)
        .then(response => response.json())
        .then(response => console.log(response))
        .catch(err => console.error(err));
})
// Fetch asset by ID
router.post("/asset", async (req: Request<{}, {}, GetSignaturesForAssetParams>, res: Response): Promise<any> => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: "Asset id is required" });
        }
        const asset = await fetchRPC("getAsset", { id });
        res.json(asset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch asset details" });
    }
});
// Fetch asset proof
router.post("/asset/proof", async (req: Request<{}, {}, GetAssetProofParams>, res: Response): Promise<any> => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: "Asset id is required" });
        }
        const proof = await fetchRPC("getAssetProof", { id });
        res.json(proof);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch asset proof" });
    }
});

// Fetch multiple assets by their IDs
router.post("/assets/batch", async (req: Request<{}, {}, GetAssetsByBatchParams>, res: Response): Promise<any> => {
    try {
        // Expect an array of asset IDs in the request body
        const { assetIds } = req.body;

        // Validate input
        if (!Array.isArray(assetIds)) {
            return res.status(400).json({ error: "assetIds must be an array" });
        }

        const assets = await fetchRPC("getAssetBatch", {
            ids: assetIds
        });
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch assets batch" });
    }
});
 
router.post("/assets/proof/batch", async (req: Request<{}, {}, GetAssetProofBatchParams>, res: Response): Promise<any> => {
    try {
        // Expect an array of asset IDs in the request body
        const { assetIds } = req.body;

        // Validate input
        if (!Array.isArray(assetIds)) {
            return res.status(400).json({ error: "assetIds must be an array" });
        }

        const proofs = await fetchRPC("getAssetProofBatch", {
            ids: assetIds
        });
        res.json(proofs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch asset proofs batch" });
    }
});
// Fetch assets by Owner
router.post("/assets/owner", async (req: Request<{}, {}, GetAssetsByOwnerParams>, res: Response): Promise<any> => {
    try {
        const {
            ownerAddress,
            sortBy,
            limit,
            page,
            before,
            after
        } = req.body;

        if (!ownerAddress) {
            return res.status(400).json({ error: "ownerAddress is required" });
        }

        const params: GetAssetsByOwnerParams = {
            ownerAddress,
        };

        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (before) params.before = before;
        if (after) params.after = after;

        const assets = await fetchRPC("getAssetsByOwner", params);
        console.log("assets: ", assets);
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch assets by owner" });
    }
});


// Fetch assets by Authority
router.post("/assets/authority", async (req: Request<{}, {}, GetAssetsByAuthorityParams>, res: Response): Promise<any> => {
    try {
        const {
            authorityAddress,
            sortBy,
            limit,
            page,
            before,
            after
        } = req.body;

        // Validate required parameter
        if (!authorityAddress) {
            return res.status(400).json({ error: "authorityAddress is required" });
        }

        // Build params object
        const params: GetAssetsByAuthorityParams = {
            authorityAddress,
        };

        // Add optional parameters if they exist
        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (before) params.before = before;
        if (after) params.after = after;

        const assets = await fetchRPC("getAssetsByAuthority", params);
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch assets by authority" });
    }
});

// Fetch assets by Group
router.post("/assets/group", async (req: Request<{}, {}, GetAssetsByGroupParams>, res: Response): Promise<any> => {
    try {
        const {
            groupKey,
            groupValue,
            sortBy,
            limit,
            page,
            before,
            after
        } = req.body;

        // Validate required parameters
        if (!groupKey || !groupValue) {
            return res.status(400).json({ error: "groupKey and groupValue are required" });
        }

        // Build params object
        const params: GetAssetsByGroupParams = {
            groupKey,
            groupValue,
        };

        // Add optional parameters if they exist
        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (before) params.before = before;
        if (after) params.after = after;

        const assets = await fetchRPC("getAssetsByGroup", params);
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch assets by group" });
    }
});
// Fetch assets by Creator
router.post("/assets/creator", async (req: Request<{}, {}, GetAssetsByCreatorParams>, res: Response): Promise<any> => {
    try {
        const {
            creatorAddress,
            onlyVerified,
            sortBy,
            limit,
            page,
            before,
            after
        } = req.body;

        // Validate required parameter
        if (!creatorAddress) {
            return res.status(400).json({ error: "creator address is required" });
        }

        // Build params object
        const params: GetAssetsByCreatorParams = {
            creatorAddress,
        };

        // Add optional parameters if they exist
        if (onlyVerified !== undefined) params.onlyVerified = onlyVerified;
        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (before) params.before = before;
        if (after) params.after = after;

        const assets = await fetchRPC("getAssetsByCreator", params);
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch assets by creator" });
    }
});
// Fetch signatures for asset
router.post("/asset/signatures", async (req: Request<{}, {}, GetSignaturesForAssetParams>, res: Response): Promise<any> => {
    try {
        const {
            id,
            page,
            limit,
            before,
            after
        } = req.body;

        // Validate required parameter
        if (!id) {
            return res.status(400).json({ error: "Asset id is required" });
        }

        // Build params object
        const params: GetSignaturesForAssetParams = {
            id,
        };

        // Add optional parameters if they exist
        if (page) params.page = Number(page);
        if (limit) {
            // Ensure limit doesn't exceed maximum of 1000
            params.limit = Math.min(Number(limit), 1000);
        }
        if (before) params.before = before;
        if (after) params.after = after;

        const signatures = await fetchRPC("getSignaturesForAsset", params);
        res.json(signatures);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch signatures for asset" });
    }
});
// Fetch token accounts
router.post("/token/accounts", async (req: Request<{}, {}, GetTokenAccountsParams>, res: Response): Promise<any> => {
    try {
        const {
            mint,
            ownerAddress,
            limit,
            page,
            cursor,
            before,
            after,
            showZeroBalance
        } = req.body;

        // Validate that at least one of mint or owner is provided
        if (!mint && !ownerAddress) {
            return res.status(400).json({
                error: "Either mint or owner address is required"
            });
        }

        // Build params object
        const params: GetTokenAccountsParams = {};

        // Add parameters if they exist
        if (mint) params.mint = mint;
        if (ownerAddress) params.ownerAddress = ownerAddress;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (cursor) params.cursor = cursor;
        if (before) params.before = before;
        if (after) params.after = after;
        if (showZeroBalance !== undefined) params.showZeroBalance = showZeroBalance;

        const tokenAccounts = await fetchRPC("getTokenAccounts", params);
        console.log("tokenAccounts: ", tokenAccounts);
        res.json(tokenAccounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch token accounts" });
    }
});
// Search assets endpoint
router.post("/assets/search", async (req: Request<{}, {}, SearchAssetsParams>, res: Response): Promise<any> => {
    try {
        const {
            negate,
            interface: interfaceType,
            ownerAddress,
            ownerType,
            creatorAddress,
            creatorVerified,
            authorityAddress,
            grouping,
            delegate,
            frozen,
            supply,
            supplyMint,
            compressed,
            compressible,
            royaltyTargetType,
            burnt,
            sortBy,
            limit,
            page,
            before,
            after,
            jsonUri
        } = req.body;

        // Build params object
        const params: SearchAssetsParams = {};

        // Add parameters if they exist
        if (negate !== undefined) params.negate = negate;
        if (interfaceType) params.interface = interfaceType;
        if (ownerAddress) params.ownerAddress = ownerAddress;
        if (ownerType) params.ownerType = ownerType;
        if (creatorAddress) params.creatorAddress = creatorAddress;
        if (creatorVerified !== undefined) params.creatorVerified = creatorVerified;
        if (authorityAddress) params.authorityAddress = authorityAddress;
        if (grouping) params.grouping = grouping;
        if (delegate) params.delegate = delegate;
        if (frozen !== undefined) params.frozen = frozen;
        if (supply !== undefined) params.supply = Number(supply);
        if (supplyMint) params.supplyMint = supplyMint;
        if (compressed !== undefined) params.compressed = compressed;
        if (compressible !== undefined) params.compressible = compressible;
        if (royaltyTargetType) params.royaltyTargetType = royaltyTargetType;
        if (burnt !== undefined) params.burnt = burnt;
        if (sortBy) params.sortBy = sortBy;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (before) params.before = before;
        if (after) params.after = after;
        if (jsonUri) params.jsonUri = jsonUri;

        const assets = await fetchRPC("searchAssets", params);
        res.json(assets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to search assets" });
    }
});


// Combined endpoint: get token accounts + asset metadata
router.post("/token/accounts/with-assets", async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            mint,
            ownerAddress,
            limit,
            page,
            cursor,
            before,
            after,
            showZeroBalance
        } = req.body;

        if (!mint && !ownerAddress) {
            return res.status(400).json({ error: "Either mint or owner address is required" });
        }

        const params: GetTokenAccountsParams = {};
        if (mint) params.mint = mint;
        if (ownerAddress) params.ownerAddress = ownerAddress;
        if (limit) params.limit = Number(limit);
        if (page) params.page = Number(page);
        if (cursor) params.cursor = cursor;
        if (before) params.before = before;
        if (after) params.after = after;
        if (showZeroBalance !== undefined) params.showZeroBalance = showZeroBalance;

        const tokenAccountsResponse = await fetchRPC("getTokenAccounts", params);
        const tokenAccounts = tokenAccountsResponse?.token_accounts || [];

        if (!tokenAccounts.length) {
            return res.json({ ...tokenAccountsResponse, token_accounts: [] });
        }

        // Extract unique mint addresses
        const mintAddresses: string[] = [...new Set<string>(tokenAccounts.map((t: any) => t.mint as string))];

        // Fetch all asset metadata concurrently
        const assetResults = await Promise.allSettled(
            mintAddresses.map((id: string) =>
                fetchRPC("getAsset", { id }).catch(() => null)
            )
        );

        // Map mint -> asset metadata
        const assetMap: Record<string, any> = {};
        assetResults.forEach((result, i) => {
            if (result.status === "fulfilled" && result.value) {
                const asset = result.value;
                const metadata = asset.content?.metadata || {};
                const links = asset.content?.links || {};
                assetMap[mintAddresses[i]] = {
                    name: metadata.name || null,
                    symbol: metadata.symbol || null,
                    description: metadata.description || null,
                    image: links.image || null,
                    json_uri: asset.content?.json_uri || null
                };
            }
        });

        // Merge token account + metadata
        const enrichedAccounts = tokenAccounts.map((account: any) => ({
            ...account,
            ...assetMap[account.mint] // merges metadata if available
        }));

        const combinedResponse = {
            ...tokenAccountsResponse,
            token_accounts: enrichedAccounts
        };

        res.json(combinedResponse);
    } catch (error) {
        console.error("Error in /token/accounts/with-assets:", error);
        res.status(500).json({ error: "Failed to fetch combined token and asset data" });
    }
});

export default router;
