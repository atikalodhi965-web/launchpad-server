import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    // USERS
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("username").notNullable().unique().index();
    table.string("fullname");
    table.text("bio");
    table.string("profile_image_url");
    table.string("cover_image_url");
    table.string("website");
    table.timestamp("joined_date").defaultTo(knex.fn.now());
    table.bigInteger("followers_count").defaultTo(0);
    table.bigInteger("following_count").defaultTo(0);
  });

  // COINS
  await knex.schema.createTable("coins", (table) => {
    table.string("id").primary(); // mint address
    table.string("name").notNullable();
    table.string("symbol").notNullable().index();
    table.string("logo_url");
    table.decimal("current_price", 30, 10).defaultTo(0);
    table.decimal("market_cap", 30, 2).defaultTo(0);
    table.decimal("total_supply", 40, 10).defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.text("description");
    table.string("website_url");
    table.string("twitter_url");
    table.string("telegram_url");

    table.uuid("created_by").references("id").inTable("users").onDelete("SET NULL");

    table.enu("status", ["draft", "launching", "live", "migrated"], {
      useNative: true,
      enumName: "coin_status_enum",
    }).defaultTo("draft");

    table.decimal("volume_24h", 30, 2).defaultTo(0);
    table.decimal("price_change_24h", 20, 8).defaultTo(0);
    table.decimal("bonding_progress", 10, 4).defaultTo(0);

    table.decimal("ath_price", 30, 10);
    table.decimal("ath_marketcap", 30, 2);

    table.decimal("bonding_target_amount", 30, 10);
    table.decimal("bonding_current_amount", 30, 10);

    table.string("mint_address").unique().notNullable();
  });

  // USER_COINS
  await knex.schema.createTable("user_coins", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

    table.decimal("tokens_held", 40, 10).defaultTo(0);
    table.decimal("avg_buy_price", 30, 10).defaultTo(0);

    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.unique(["user_id", "coin_id"]);
  });

  // FOLLOWERS
  await knex.schema.createTable("followers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("follower_id").references("id").inTable("users").onDelete("CASCADE");
    table.uuid("following_id").references("id").inTable("users").onDelete("CASCADE");

    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.unique(["follower_id", "following_id"]);
  });

  // WALLETS
  await knex.schema.createTable("wallets", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

    table.string("address").notNullable().unique();
    table.string("chain").notNullable().index();

    table.boolean("is_primary").defaultTo(false);

    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // TRADES
  await knex.schema.createTable("trades", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

    table.enu("type", ["buy", "sell"], {
      useNative: true,
      enumName: "trade_type_enum",
    }).notNullable();

    table.decimal("price", 30, 10).notNullable();
    table.decimal("price_impact", 10, 6);

    table.decimal("usd_value", 30, 2);
    table.decimal("input_amount", 40, 10);
    table.decimal("output_amount", 40, 10);

    table.string("tx_hash").unique().notNullable().index();

    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // COIN_CREATORS
  await knex.schema.createTable("coin_creators", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
    table.uuid("creator_id").references("id").inTable("users").onDelete("CASCADE");

    table.boolean("is_shareable").defaultTo(false);

    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // USER_PORTFOLIO
  await knex.schema.createTable("user_portfolio", (table) => {
    table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");

    table.decimal("total_value", 30, 2).defaultTo(0);
    table.decimal("total_invested", 30, 2).defaultTo(0);

    table.decimal("unrealized_pnl", 30, 2).defaultTo(0);
    table.decimal("realized_pnl", 30, 2).defaultTo(0);

    table.timestamp("last_updated").defaultTo(knex.fn.now());
  });

  // EARNING_TX
  await knex.schema.createTable("earning_tx", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("creator_id").references("id").inTable("users").onDelete("CASCADE");
    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

    table.decimal("amount", 30, 10).notNullable();

    table.enu("type", ["fee", "reward", "claim"], {
      useNative: true,
      enumName: "earning_type_enum",
    });

    table.string("reference_id");

    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // CREATOR_EARNINGS
  await knex.schema.createTable("creator_earnings", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    table.uuid("creator_id").references("id").inTable("users").onDelete("CASCADE");
    table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

    table.decimal("total_earned", 30, 10).defaultTo(0);
    table.decimal("total_claimed", 30, 10).defaultTo(0);
    table.decimal("unclaimed", 30, 10).defaultTo(0);
  });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("creator_earnings");
  await knex.schema.dropTableIfExists("earning_tx");
  await knex.schema.dropTableIfExists("user_portfolio");
  await knex.schema.dropTableIfExists("coin_creators");
  await knex.schema.dropTableIfExists("trades");
  await knex.schema.dropTableIfExists("wallets");
  await knex.schema.dropTableIfExists("followers");
  await knex.schema.dropTableIfExists("user_coins");
  await knex.schema.dropTableIfExists("coins");
  await knex.schema.dropTableIfExists("users");

  await knex.raw("DROP TYPE IF EXISTS coin_status_enum");
  await knex.raw("DROP TYPE IF EXISTS trade_type_enum");
  await knex.raw("DROP TYPE IF EXISTS earning_type_enum");
}

