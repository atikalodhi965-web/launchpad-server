import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
   

    // COIN MEDIA
    await knex.schema.createTable("coin_media", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

        table.string("image_url");
        table.string("video_url");
        table.string("thumbnail_url");

        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.unique(["coin_id"]);
    });

    // COIN LAUNCH CONFIG
    await knex.schema.createTable("coin_launch_config", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("creator_id").references("id").inTable("users").onDelete("CASCADE");

        table.decimal("initial_buy_amount", 30, 10);
        table.decimal("ownership_percent", 10, 4);
        table.decimal("token_price", 30, 10);
        table.decimal("total_supply", 40, 10);

        table
            .enu("launch_status", ["pending", "active", "completed"], {
                useNative: true,
                enumName: "launch_status_enum",
            })
            .defaultTo("pending");

        table.timestamp("created_at").defaultTo(knex.fn.now());
    });

    // COIN LAUNCH PURCHASES
    await knex.schema.createTable("coin_launch_purchases", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table.decimal("amount_paid", 30, 10);
        table.decimal("tokens_received", 40, 10);

        table.timestamp("created_at").defaultTo(knex.fn.now());
    });

    // COIN CATEGORIES
    await knex.schema.createTable("coin_categories", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.string("name").unique().notNullable();
    });

    // COIN VIDEOS
    await knex.schema.createTable("coin_videos", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("creator_id").references("id").inTable("users").onDelete("CASCADE");

        table.string("video_url").notNullable();
        table.string("thumbnail_url");
        table.text("caption");

        table.integer("duration_seconds");
        table.bigInteger("views_count").defaultTo(0);
        table.bigInteger("likes_count").defaultTo(0);
        table.bigInteger("comments_count").defaultTo(0);

        table.boolean("is_pinned").defaultTo(false);
        table.integer("position").defaultTo(0);

        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index(["coin_id"]);
    });

    // VIDEO INTERACTIONS
    await knex.schema.createTable("video_interactions", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.uuid("video_id").references("id").inTable("coin_videos").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table
            .enu("type", ["like", "view", "commented"], {
                useNative: true,
                enumName: "video_interaction_enum",
            })
            .notNullable();

        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.unique(["video_id", "user_id", "type"]);
    });

    // COIN CATEGORY MAP
    await knex.schema.createTable("coin_category_map", (table) => {
        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("category_id").references("id").inTable("coin_categories").onDelete("CASCADE");

        table.primary(["coin_id", "category_id"]);
    });

    // VIDEO COMMENTS
    await knex.schema.createTable("video_comments", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.uuid("video_id").references("id").inTable("coin_videos").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table.text("comment_text").notNullable();

        table.timestamp("created_at").defaultTo(knex.fn.now());
    });

    // PRICE HISTORY
    await knex.schema.createTable("price_history", (table) => {
        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

        table.decimal("price", 30, 10);
        table.decimal("market_cap", 30, 2);
        table.decimal("volume", 30, 2);

        table
            .enu("interval_type", ["1m", "5m", "1h", "6h", "24h"], {
                useNative: true,
                enumName: "interval_type_enum",
            })
            .notNullable();

        table.timestamp("recorded_at").defaultTo(knex.fn.now());

        table.primary(["coin_id", "interval_type", "recorded_at"]); // better than single id
    });

    // COIN LIQUIDITY POOLS
    await knex.schema.createTable("coin_liquidity_pools", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");

        table.decimal("sol_reserves", 40, 10);
        table.decimal("token_reserves", 40, 10);
        table.decimal("k_constant", 50, 20);

        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });

    // COIN HOLDERS
    await knex.schema.createTable("coin_holders", (table) => {
        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table.decimal("tokens_held", 40, 10);
        table.decimal("value_usd", 30, 2);

        table.string("wallet_address");

        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.primary(["coin_id", "user_id"]);
    });

    // COIN COMMENTS
    await knex.schema.createTable("coin_comments", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.string("coin_id").references("id").inTable("coins").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table.text("commented_text").notNullable();

        table.bigInteger("likes_count").defaultTo(0);
        table.bigInteger("replies_count").defaultTo(0);

        table.uuid("parent_id").references("id").inTable("coin_comments").onDelete("CASCADE");

        table.timestamp("created_at").defaultTo(knex.fn.now());
    });

    // COMMENT INTERACTIONS
    await knex.schema.createTable("comment_interactions", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

        table.uuid("comment_id").references("id").inTable("coin_comments").onDelete("CASCADE");
        table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");

        table.string("type").notNullable();

        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.unique(["comment_id", "user_id"]);
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("comment_interactions");
    await knex.schema.dropTableIfExists("coin_comments");
    await knex.schema.dropTableIfExists("coin_holders");
    await knex.schema.dropTableIfExists("coin_liquidity_pools");
    await knex.schema.dropTableIfExists("price_history");
    await knex.schema.dropTableIfExists("video_comments");
    await knex.schema.dropTableIfExists("coin_category_map");
    await knex.schema.dropTableIfExists("video_interactions");
    await knex.schema.dropTableIfExists("coin_videos");
    await knex.schema.dropTableIfExists("coin_categories");
    await knex.schema.dropTableIfExists("coin_launch_purchases");
    await knex.schema.dropTableIfExists("coin_launch_config");
    await knex.schema.dropTableIfExists("coin_media");

    // await knex.raw("DROP TYPE IF EXISTS launch_status_enum");
    // await knex.raw("DROP TYPE IF EXISTS video_interaction_enum");
    // await knex.raw("DROP TYPE IF EXISTS interval_type_enum");
}

