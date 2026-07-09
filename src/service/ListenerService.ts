// import { Client, Notification } from "pg";
// import { WebSocketService } from "./websocketService";
// import { fetchTransactionFeedRow } from "../utils/tokenRelatedUtils";
// import knex from "../db/knex";


// type PgHandler = (payload: any) => Promise<void>;

// export async function startPostgresListener(
//     wsService: WebSocketService
// ): Promise<void> {
//     const client = new Client({
//         connectionString: process.env.DATABASE_URL,
//     });

//     await client.connect();
//     console.log("✅ Connected to PostgreSQL for LISTEN / NOTIFY");

//     const channelHandlers: Record<string, PgHandler> = {
//         // 🆕 Launchpad new
//         launchpad_new_insert: async (token) => {
//             wsService.io.emit("launchpad:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("💎new websocket: ", token.mint);
//         },

//         // 🟡 Almost bonded
//         launchpad_almost_bonded_insert: async (token) => {
//             wsService.broadcastAlmostBondedToken(token);
//             console.log("💎almost bonded websocket: ", token.mint);
//         },

//         // 🔵 Migrated
//         launchpad_migrated_insert: async (token) => {
//             wsService.broadcastMigratedToken(token);
//             console.log("💎migrated websocket: ", token.mint);
//         },
//         // =====================
//         // DISCOVERY
//         // =====================

//         // 🔥 Trending
//         discovery_trending_insert: async (token) => {
//             wsService.io.emit("discovery:trending:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("💎trending websocket: ", token.mint);
//         },

//         // 🤖 AI
//         discovery_ai_insert: async (token) => {
//             wsService.io.emit("discovery:ai:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("ai websocket: ", token.mint);
//         },

//         // 💎 Bluechip Meme
//         discovery_bluechip_meme_insert: async (token) => {
//             wsService.io.emit("discovery:bluechip_meme:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("blue chip meme websocket: ", token.mint);
//         },

//         // 🔥 Popular
//         discovery_popular_insert: async (token) => {
//             wsService.io.emit("discovery:popular:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("popular websocket: ", token.mint);
//         },

//         // 📈 XStock
//         discovery_xstock_insert: async (token) => {
//             wsService.io.emit("discovery:xstock:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("xstock websocket: ", token.mint);
//         },

//         // 🧪 LSTS
//         discovery_lsts_insert: async (token) => {
//             wsService.io.emit("discovery:lsts:new", {
//                 type: "new_insert",
//                 payload: token,
//                 timestamp: new Date().toISOString(),
//             });
//             console.log("lsts websocket: ", token.mint);
//         },


//         // 💥 NEW TRANSACTION
//         transaction_insert: async ({ transaction_id }) => {
//             console.log("💸 PG → transaction:", transaction_id);

//             const row = await fetchTransactionFeedRow(transaction_id);
//             if (!row) return;
//             console.log("transaction websocket: ", row);
//             wsService.io.emit("transaction:new", {
//                 type: "transaction_insert",
//                 payload: row,
//                 timestamp: new Date().toISOString(),
//             });
//         },

//         token_stats_update: async ({ mint }) => {
//             console.log("📊 Token stats updated:", mint);

//             // 1️⃣ Discovery tokens
//             const discoveryRow = await fetchDiscoveryToken(mint);
//             if (discoveryRow) {
//                 wsService.io.emit("discovery:update", {
//                     mint,
//                     category: discoveryRow.category,
//                     payload: discoveryRow,
//                     timestamp: new Date().toISOString(),
//                 });
//             }
//             // console.log("discover stats: ", mint);
//             // 2️⃣ Launchpad tokens
//             const launchpadRow = await fetchLaunchpadToken(mint);
//             if (launchpadRow) {
//                 wsService.io.emit("launchpad:update", {
//                     mint,
//                     category: launchpadRow.category,
//                     payload: launchpadRow,
//                     timestamp: new Date().toISOString(),
//                 });
//             }
//             // console.log("launcpad stats: ", mint);


//         },

//     };

//     for (const channel of Object.keys(channelHandlers)) {
//         await client.query(`LISTEN ${channel}`);
//         console.log(`✅ Listening on channel: ${channel}`);
//     }

//     client.on("notification", async (msg: Notification) => {
//         if (!msg.channel || !msg.payload) return;

//         const handler = channelHandlers[msg.channel];
//         if (!handler) return;

//         try {
//             const payload = JSON.parse(msg.payload);
//             await handler(payload);
//         } catch (err) {
//             console.error("❌ PG NOTIFY handler error:", err);
//         }
//     });

//     process.on("SIGINT", async () => {
//         console.log("🛑 Closing PG listener...");
//         await client.end();
//     });
// }

// async function fetchDiscoveryToken(mint: string) {
//     return knex("discovery_tokens")
//         .select(
//             "mint",
//             "name",
//             "symbol",
//             "image",
//             "marketcap",
//             "price_change_24h",
//             "volume_24h",
//             "liquidity",
//             "updated_at",
//             "category"
//         )
//         .where({ mint })
//         .first();
// }
// async function fetchLaunchpadToken(mint: string) {
//     return knex("launchpad_tokens")
//         .select("*")
//         .where({ mint })
//         .first();
// }
